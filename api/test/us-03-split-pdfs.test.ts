import { beforeEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { importMenu } from "../src/menu/import";
import { splitPdfPages, PDF_PAGE_CONCURRENCY } from "../src/menu/pdf-pages";
import { createRestaurant } from "../src/restaurants/repo";
import type { LlmRequest } from "../src/llm/types";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([400, 400]).drawText(`Page ${i + 1}`);
  return doc.save();
}

const dish = (name: string, price: number) => ({ name, section: "Mains", price, description: null, tags: [] });

/** Answers with the dishes for whichever page the request carries. */
function byPage(pages: Record<number, ReturnType<typeof dish>[] | "garbage">, gate?: { active: number; max: number; delayMs: number }) {
  return async (req: LlmRequest) => {
    // A single-page PDF is sent whole, with no page label: that is page 1.
    const page = Number(JSON.stringify(req.messages).match(/PAGE: (\d+) of/)?.[1] ?? 1);
    if (gate) {
      gate.active++;
      gate.max = Math.max(gate.max, gate.active);
      await new Promise((r) => setTimeout(r, gate.delayMs));
      gate.active--;
    }
    const answer = pages[page];
    return answer === "garbage" ? { nonsense: true } : { dishes: answer ?? [] };
  };
}

describe("US-03 Import a menu: long PDFs are read page by page (A2 v2)", () => {
  let db: ReturnType<typeof testDb>;
  beforeEach(async () => {
    db = testDb();
    await createRestaurant(db, { id: "r1", name: "PDF Place", address: "1 Main St" });
  });
  const run = async (pdf: Uint8Array, llm: ReturnType<typeof mockLlm>) =>
    importMenu({ db, blobs: memoryBlobs(), llm, fetch: fakeFetch({ "https://pdf.example/menu.pdf": { body: pdf, contentType: "application/pdf" } }) }, { restaurantId: "r1", url: "https://pdf.example/menu.pdf" });

  it("[ai] AC1 unit: a PDF splits into one single-page PDF per page", async () => {
    const pages = await splitPdfPages(await pdfWithPages(3));
    expect(pages).toHaveLength(3);
    for (const p of pages) expect((await PDFDocument.load(p)).getPageCount()).toBe(1);
    expect(PDF_PAGE_CONCURRENCY).toBe(4);
  });

  it("[ai] AC1 integration: a multi-page PDF is read one page per model call and the dishes are combined in page order", async () => {
    const answer = byPage({ 1: [dish("Nachos", 9)], 2: [dish("Tacos", 11), dish("Burrito", 12)], 3: [dish("Flan", 6)] });
    const llm = mockLlm([answer, answer, answer]);
    const result = await run(await pdfWithPages(3), llm);
    expect(result).toMatchObject({ status: "active", dishCount: 4 });
    expect(llm.calls).toHaveLength(3);
    const names = (db.raw.prepare("SELECT name FROM dishes ORDER BY rowid").all() as { name: string }[]).map((d) => d.name);
    expect(names).toEqual(["Nachos", "Tacos", "Burrito", "Flan"]);
  });

  it("[ai] AC1 integration: a page with no dishes (a cover page) is fine, but a PDF with no dishes at all is not", async () => {
    const someEmpty = byPage({ 2: [dish("Tacos", 11)] });
    expect(await run(await pdfWithPages(2), mockLlm([someEmpty, someEmpty]))).toMatchObject({ status: "active", dishCount: 1 });
    const allEmpty = byPage({});
    expect(await run(await pdfWithPages(2), mockLlm([allEmpty, allEmpty]))).toMatchObject({ status: "needs_review", dishCount: 0 });
  });

  it("[ai] AC3 integration: if one page fails all its retries, the whole menu goes to review instead of being stored half-read", async () => {
    const answer = byPage({ 1: [dish("Nachos", 9)], 2: "garbage" });
    const result = await run(await pdfWithPages(2), mockLlm(Array(4).fill(answer)));
    expect(result).toMatchObject({ status: "needs_review", dishCount: 0 });
  });

  it("[ai] AC1 integration: dishes repeated across pages are merged, and at most 4 pages are read at once", async () => {
    const gate = { active: 0, max: 0, delayMs: 30 };
    const pages: Record<number, ReturnType<typeof dish>[]> = { 1: [dish("Tacos", 11)], 2: [dish("Tacos", 11)] };
    for (let p = 3; p <= 6; p++) pages[p] = [dish(`Dish ${p}`, p)];
    const answer = byPage(pages, gate);
    const result = await run(await pdfWithPages(6), mockLlm(Array(6).fill(answer)));
    expect(result).toMatchObject({ status: "active", dishCount: 5 });
    expect(gate.max).toBeLessThanOrEqual(4);
    expect(gate.max).toBeGreaterThan(1);
  });

  it("[ai] AC1 integration: a single-page PDF is read in one call as before", async () => {
    const answer = byPage({ 1: [dish("Nachos", 9)] });
    const llm = mockLlm([answer]);
    expect(await run(await pdfWithPages(1), llm)).toMatchObject({ status: "active", dishCount: 1 });
    expect(llm.calls).toHaveLength(1);
  });
});
