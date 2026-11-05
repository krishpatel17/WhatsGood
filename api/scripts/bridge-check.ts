// Small opt-in live checks. Unit tests use injected runners and need no model login.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { selectLlm, llmPath } from "../src/llm/select";
import type { LlmContent } from "../src/llm/types";
import { writePdfImages } from "./bridge/pdf-images";

const provider = process.env.LLM_BRIDGE_PROVIDER ?? "claude";
const url = process.env.LLM_BRIDGE_URL ?? `http://127.0.0.1:${provider === "codex" ? 8791 : 8790}`;
const llm = selectLlm({ bridgeProvider: provider, bridgeUrl: url, bridgeModel: process.env.LLM_BRIDGE_MODEL });
const schema = z.object({ name: z.string(), price: z.number() });
async function check(label: string, content: LlmContent[]) {
  const response = await llm.json({ task: "bridge_smoke", system: "Extract the one printed menu item. Preserve its name and price. Return JSON matching the schema.", messages: [{ role: "user", content }], schema, effort: "low" });
  const parsed = schema.parse(response.data);
  if (parsed.name !== "Tomato Soup" || parsed.price !== 6) throw new Error(`${label} extraction failed: ${response.raw}`);
  console.log(JSON.stringify({ check: label, status: "passed", llmPath: llmPath(llm), model: llm.model, usage: response.usage }));
}
await check("text", [{ type: "text", text: "MENU\nTomato Soup $6.00" }]);
if (process.argv.includes("--media")) {
  const dir = mkdtempSync(join(tmpdir(), "bridge-check-"));
  try {
    const doc = await PDFDocument.create(); doc.addPage([500, 200]).drawText("Tomato Soup $6.00", { x: 30, y: 100, size: 28 });
    const pdf = await doc.save();
    const [image] = await writePdfImages(pdf, dir, 0, new AbortController().signal);
    await check("image", [{ type: "image", mediaType: "image/png", data: readFileSync(image).toString("base64") }]);
    await check("pdf", [{ type: "pdf", data: Buffer.from(pdf).toString("base64") }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
