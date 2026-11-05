import type { LlmContent } from "../llm/types";

export type SourceKind = "html" | "pdf" | "ordering-page" | "image";

const ORDERING_HOSTS = [/(^|\.)toasttab\.com$/, /(^|\.)square\.site$/, /(^|\.)squareup\.com$/, /(^|\.)chownow\.com$/, /(^|\.)clover\.com$/];

export function pickExtractor(url: string, contentType: string): SourceKind {
  const type = contentType.toLowerCase();
  const { hostname, pathname } = new URL(url);
  if (type.includes("application/pdf") || pathname.toLowerCase().endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/")) return "image";
  if (ORDERING_HOSTS.some((re) => re.test(hostname))) return "ordering-page";
  return "html";
}

export const STRUCTURED_DATA_HEADING = "\n\nSTRUCTURED DATA:\n";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Visible text of an HTML page plus any embedded structured data (JSON-LD), without scripts or styles. */
export function htmlToText(html: string): string {
  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|div|section|article|li|ul|ol|h[1-6]|br|tr|td|th|table|header|footer|nav|span)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return jsonLd.length ? `${text}${STRUCTURED_DATA_HEADING}${jsonLd.join("\n")}` : text;
}

export type FetchedSource = { url: string; kind: SourceKind; contentType: string; bytes: Uint8Array };

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const SOURCE_TIMEOUT_MS = 15_000;

/** Bound bytes before buffering, including in benchmark snapshot/render wrappers. */
export async function sourceBytes(res: Response, signal?: AbortSignal | null): Promise<Uint8Array> {
  if (Number(res.headers.get('content-length')) > MAX_SOURCE_BYTES) {
    void res.body?.cancel(); throw new Error('Menu source is too large.');
  }
  const reader = res.body?.getReader();
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, {once:true});
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (signal?.aborted) { cancel(); throw new Error('Menu source timed out.'); }
    while (reader) {
      const chunk = await reader.read();
      if (signal?.aborted) throw new Error('Menu source timed out.');
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_SOURCE_BYTES) { await reader.cancel(); throw new Error('Menu source is too large.'); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally { signal?.removeEventListener('abort', cancel); reader?.releaseLock(); }
}

/** Website imports accept public DNS names, never credentials or IP/local destinations. */
export function publicSourceUrl(input: string): URL {
  const url = new URL(input);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') || /\.(localhost|local|internal|lan|home|test|invalid)$/.test(host)) {
    throw new Error('Menu URL must use HTTP(S), a public website hostname and no credentials.');
  }
  return url;
}

export async function fetchSource(fetcher: typeof fetch, url: string): Promise<FetchedSource> {
  let current = publicSourceUrl(url);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Menu source timed out.'));
      controller.abort();
    }, SOURCE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([timeout, (async () => {
      for (let redirects = 0; redirects <= 5; redirects++) {
        const res = await fetcher(current.href, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'WhatsGoodMenuBot/0.1 (student project)' } });
        if (controller.signal.aborted) { void res.body?.cancel(); throw new Error('Menu source timed out.'); }
        if ([301,302,303,307,308].includes(res.status)) {
          void res.body?.cancel();
          const location = res.headers.get('location');
          if (!location || redirects === 5) throw new Error('Menu source has an invalid or excessive redirect chain.');
          current = publicSourceUrl(new URL(location, current).href);
          continue;
        }
        if (!res.ok) { void res.body?.cancel(); throw new Error(`Fetching ${current.href} failed with HTTP ${res.status}`); }
        const contentType = res.headers.get('content-type') ?? '';
        if (!/^(text\/(html|plain)|application\/(pdf|xhtml\+xml)|image\/(jpeg|png|gif|webp))(;|$)/i.test(contentType)) {
          void res.body?.cancel(); throw new Error('Menu source has an unsupported or missing Content-Type.');
        }
        const bytes = await sourceBytes(res, controller.signal);
        return { url: current.href, contentType, kind: pickExtractor(current.href, contentType), bytes };
      }
      throw new Error('Too many redirects.');
    })()]);
  } finally { clearTimeout(timer); }
}

export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** What the model is shown for a source: page text, the PDF itself, or the image. */
export function sourceContent(src: FetchedSource): LlmContent[] {
  const header: LlmContent = { type: "text", text: `SOURCE URL: ${src.url}\nSOURCE TYPE: ${src.kind}` };
  if (src.kind === "pdf") return [{ type: "pdf", data: base64(src.bytes) }, header];
  if (src.kind === "image") {
    const mediaType = IMAGE_TYPES.find((t) => src.contentType.startsWith(t)) ?? "image/jpeg";
    return [{ type: "image", mediaType, data: base64(src.bytes) }, header];
  }
  return [header, { type: "text", text: `PAGE TEXT:\n${htmlToText(new TextDecoder().decode(src.bytes))}` }];
}

export function textOf(src: FetchedSource): string | null {
  return src.kind === "html" || src.kind === "ordering-page" ? htmlToText(new TextDecoder().decode(src.bytes)) : null;
}
