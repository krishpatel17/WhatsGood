import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { runWithCodex, strictOutputSchema } from "../scripts/codex-bridge";

const request = { provider: "codex" as const, task: "test", system: "Extract faithfully", messages: [{ role: "user" as const, content: "Soup $6" }], jsonSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false } };
const event = (data: unknown) => [JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(data) } }), JSON.stringify({ type: "turn.completed", usage: { input_tokens: 42, cached_input_tokens: 12, output_tokens: 5 } })].join("\n");
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("local Codex bridge runner", () => {
  it("[ai] creates an isolated schema-constrained invocation, preserves retry context and cleans up", async () => {
    let cwd = "";
    const result = await runWithCodex({ ...request, model: "test-codex-model", messages: [...request.messages, { role: "assistant", content: '{"name":"Wrong"}' }, { role: "user", content: "VALIDATION FAILED" }] }, undefined, { execute: async (call) => {
      cwd = call.cwd;
      expect(call.args).toContain("--ignore-user-config"); expect(call.args).toContain("--ephemeral"); expect(call.args).toContain("read-only");
      expect(call.args).toContain("test-codex-model"); expect(call.prompt).toContain("VALIDATION FAILED"); expect(call.prompt).toContain('{"name":"Wrong"}');
      expect(call.env.OPENAI_API_KEY).toBeUndefined(); expect(call.env.CODEX_API_KEY).toBeUndefined();
      const schema = JSON.parse(readFileSync(call.args[call.args.indexOf("--output-schema") + 1], "utf8"));
      expect(schema.required).toEqual(["name"]);
      return event({ name: "Soup" });
    } });
    expect(result).toEqual({ data: { name: "Soup" }, raw: '{"name":"Soup"}', usage: { input_tokens: 42, output_tokens: 5 } });
    expect(existsSync(cwd)).toBe(false);
  });
  it("[ai] attaches images and every PDF page as files, preserving their positions in the prompt", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage([100, 100]).drawText("Menu", { x: 5, y: 50, size: 10 }); pdf.addPage([100, 100]);
    await runWithCodex({ ...request, messages: [{ role: "user", content: [{ type: "image", mediaType: "image/png", data: Buffer.from("image").toString("base64") }, { type: "pdf", data: Buffer.from(await pdf.save()).toString("base64") }] }] }, undefined, { execute: async (call) => {
      expect(call.args.filter((s) => s === "--image")).toHaveLength(3);
      expect(readdirSync(call.cwd).filter((s) => s.endsWith(".png"))).toHaveLength(3);
      expect(call.prompt).toContain("PDF page 2");
      return event({ name: "Soup" });
    } });
  });
  it("[ai] normalizes nested optional properties for Codex strict output without changing the caller schema", () => {
    const schema = { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { kind: { type: "string" } } } } } };
    expect(strictOutputSchema(schema)).toMatchObject({ required: ["rows"], properties: { rows: { items: { required: ["kind"], additionalProperties: false } } } });
    expect(schema).not.toHaveProperty("required");
  });
  it("[ai] propagates CLI failures, missing completion and malformed structured output accurately", async () => {
    await expect(runWithCodex(request, undefined, { execute: async () => JSON.stringify({ type: "turn.failed", error: { message: "Limit reached" } }) })).rejects.toThrow(/Limit reached/);
    await expect(runWithCodex(request, undefined, { execute: async () => "" })).rejects.toThrow(/complete|output/i);
    const malformed = await runWithCodex(request, undefined, { execute: async () => event("not json").replace('"text":"\\"not json\\""', '"text":"not json"') });
    expect(malformed.data).toBeNull();
  });
  it("[ai] cancels model work on timeout and rejects an already-aborted request before launching", async () => {
    let called = false;
    const stopped = new AbortController(); stopped.abort();
    await expect(runWithCodex(request, stopped.signal, { execute: async () => { called = true; return event({}); } })).rejects.toThrow();
    expect(called).toBe(false);
    await expect(runWithCodex(request, undefined, { timeoutMs: 20, execute: async (call) => new Promise((_resolve, reject) => { call.signal.addEventListener("abort", () => reject(call.signal.reason), { once: true }); }) })).rejects.toThrow(/timed out/i);
  });
  it("[ai] exercises the real child process boundary without shell interpolation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "codex-fixture-")); dirs.push(dir);
    const fixture = join(dir, "fixture.cjs");
    writeFileSync(fixture, `process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write(${JSON.stringify(event({ name: "Soup" }))});});`);
    expect((await runWithCodex(request, undefined, { cliPath: fixture })).data).toEqual({ name: "Soup" });
    writeFileSync(fixture, "process.stdin.resume();setInterval(()=>{},1000);");
    await expect(runWithCodex(request, undefined, { cliPath: fixture, timeoutMs: 200 })).rejects.toThrow(/timed out/i);
  });
});
