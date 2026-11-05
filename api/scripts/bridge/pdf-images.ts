// Node-only PDF conversion for the Codex CLI, which accepts images rather than PDF attachments.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

export const MAX_CODEX_IMAGES = 20;

export async function writePdfImages(bytes: Uint8Array, dir: string, start: number, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const assets = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const assetPath = (name: string) => join(assets, name).replace(/\\/g, "/") + "/";
  const task = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, verbosity: 0,
    standardFontDataUrl: assetPath("standard_fonts"), cMapUrl: assetPath("cmaps"), cMapPacked: true, wasmUrl: assetPath("wasm") });
  const abort = () => { void task.destroy().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const pdf = await task.promise;
    if (start + pdf.numPages > MAX_CODEX_IMAGES) throw new Error(`Codex bridge accepts at most ${MAX_CODEX_IMAGES} attached images/PDF pages per request.`);
    const paths: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(n);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 2400 / Math.max(original.width, original.height)) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport } as unknown as Parameters<typeof page.render>[0]).promise;
        signal.throwIfAborted();
        const path = join(dir, `image-${start + paths.length}.png`);
        writeFileSync(path, canvas.toBuffer("image/png"));
        paths.push(path);
      } finally { canvas.width = canvas.height = 1; page.cleanup(); }
    }
    return paths;
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
