// Long PDF menus are read one page per model call, a few at a time, so a big menu finishes
// within the import time limit instead of waiting on one very long answer (A2 v2).
import { PDFDocument } from "pdf-lib";

export const PDF_PAGE_CONCURRENCY = 4;

/** One single-page PDF per page, in order. A PDF that can't be split comes back whole. */
export async function splitPdfPages(bytes: Uint8Array): Promise<Uint8Array[]> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    if (count <= 1) return [bytes];
    const pages: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      const one = await PDFDocument.create();
      const [page] = await one.copyPages(doc, [i]);
      one.addPage(page);
      pages.push(await one.save());
    }
    return pages;
  } catch {
    // Some real menus are malformed in ways pdf-lib can't parse.
    return [bytes];
  }
}

/** Page count from the raw file's page objects, for PDFs pdf-lib can't parse. */
export function pdfPageCount(bytes: Uint8Array): number {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return Math.max(1, (raw.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length);
}

/**
 * What each page call is sent: its own single-page PDF when the file can be split, otherwise the
 * whole PDF with an instruction to list only that page's dishes. One entry means "read it in one call".
 */
export async function pdfPageInputs(bytes: Uint8Array): Promise<{ bytes: Uint8Array; note: string }[]> {
  const pages = await splitPdfPages(bytes);
  if (pages.length > 1) return pages.map((p, i) => ({ bytes: p, note: `PAGE: ${i + 1} of ${pages.length}` }));
  const count = pdfPageCount(bytes);
  if (count <= 1) return [{ bytes, note: "" }];
  return Array.from({ length: count }, (_, i) => ({
    bytes,
    note: `PAGE: ${i + 1} of ${count}. List only the dishes printed on page ${i + 1} of ${count}.`,
  }));
}

/** Runs tasks with at most `limit` in flight, keeping results in input order. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
