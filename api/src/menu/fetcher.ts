import type { LlmContent } from "../llm/types";

export type SourceKind = "html" | "pdf" | "ordering-page" | "image";

const ORDERING_HOSTS = [/(^|\.)toasttab\.com$/, /(^|\.)square\.site$/, /(^|\.)squareup\.com$/, /(^|\.)chownow\.com$/];

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

export async function fetchSource(fetcher: typeof fetch, url: string): Promise<FetchedSource> {
  const res = await fetcher(url, { headers: { "user-agent": "WhatsGoodMenuBot/0.1 (student project)" } });
  if (!res.ok) throw new Error(`Fetching ${url} failed with HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  return { url, contentType, kind: pickExtractor(url, contentType), bytes: new Uint8Array(await res.arrayBuffer()) };
}

function base64(bytes: Uint8Array): string {
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
