import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBridge } from "../scripts/subscription-bridge";
import { bridgeLlm } from "../src/llm/bridge";
import { selectLlm, llmPath } from "../src/llm/select";
import { depsFromEnv } from "../src/app";
import { buildReport } from "../src/validation/report";

const answer = { data: { ok: true }, raw: '{"ok":true}', usage: { input_tokens: 10, output_tokens: 2 } };
const request = { task: "test", system: "Extract", messages: [], jsonSchema: { type: "object" } };
const servers: ReturnType<typeof createBridge>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise<void>((done) => { s.closeAllConnections(); s.close(() => done()); }))); });

describe("Claude and Codex bridge selection", () => {
  it("[ai] preserves the legacy Claude selection and explicitly selects Codex in the Worker", () => {
    expect(llmPath(selectLlm({ bridgeUrl: "http://127.0.0.1:8790" }))).toBe("claude-login-bridge");
    const env = { DB: {}, BUCKET: {}, LLM_BRIDGE_URL: "http://127.0.0.1:8791", LLM_BRIDGE_PROVIDER: "codex", LLM_BRIDGE_MODEL: "test-codex-model" };
    const llm = depsFromEnv(env as never).llm!;
    expect(llmPath(llm)).toBe("codex-login-bridge");
    expect(llm.model).toBe("test-codex-model");
  });
  it("[ai] refuses unknown providers and explicit bridge configurations that would silently fall back to paid API calls", () => {
    expect(() => selectLlm({ bridgeProvider: "unknown", bridgeUrl: "http://127.0.0.1:8791" })).toThrow(/provider/i);
    expect(() => selectLlm({ bridgeProvider: "codex" })).toThrow(/bridge.*url/i);
    expect(() => selectLlm({ bridgeProvider: "codex", bridgeUrl: "https://remote.example" })).toThrow(/loopback/i);
  });
  it("[ai] sends the chosen provider and model without a Claude model leaking into Codex requests", async () => {
    let sent: Record<string, unknown> = {};
    const llm = bridgeLlm({ url: "http://127.0.0.1:8791", provider: "codex", model: "test-codex-model", fetch: async (_url, init) => {
      sent = JSON.parse(String(init?.body)); return Response.json({ ...answer, provider: "codex", model: "test-codex-model" });
    } });
    expect(await llm.json({ task: "test", system: "Extract", messages: [], schema: z.object({ ok: z.boolean() }) })).toEqual(answer);
    expect(sent).toMatchObject({ provider: "codex", model: "test-codex-model" });
  });
  it("[ai] rejects a response from a mismatched provider instead of mislabelling its provenance", async () => {
    const llm = bridgeLlm({ url: "http://127.0.0.1:8791", provider: "codex", fetch: async () => Response.json({ ...answer, provider: "claude" }) });
    await expect(llm.json({ task: "test", system: "Extract", messages: [], schema: z.object({ ok: z.boolean() }) })).rejects.toThrow(/provider/i);
  });
  it("[ai] rejects unlabelled Codex responses and malformed success payloads", async () => {
    for (const body of [answer, { provider: "codex", data: {}, raw: "{}", usage: null }]) {
      const llm = bridgeLlm({ url: "http://127.0.0.1:8791/", provider: "codex", fetch: async () => Response.json(body) });
      await expect(llm.json({ task: "test", system: "Extract", messages: [], schema: z.object({ ok: z.boolean() }) })).rejects.toThrow(/provider|response/i);
    }
  });
  it("[ai] exposes local provider health and refuses wrong-provider requests before any model work", async () => {
    let calls = 0;
    const server = createBridge(async () => { calls++; return answer; }, { provider: "codex" });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect(await (await fetch(base + "/health")).json()).toEqual({ ok: true, provider: "codex" });
    for (const provider of [undefined, "claude"]) {
      const res = await fetch(base + "/json", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request, provider }) });
      expect(res.status).toBe(400);
    }
    const res = await fetch(base + "/json", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request, provider: "codex" }) });
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
    expect((await fetch(base + "/health", { headers: { origin: "https://example.com" } })).status).toBe(403);
  });
  it("[ai] labels both A2 and A3 Codex runs as subscription calls rather than Claude/API evidence", () => {
    const report = buildReport({ a1: null, a2: { promptTag: "test", model: "test-codex-model", llmPath: "codex-login-bridge", restaurants: [], bootstrap: { lo: 0, hi: 0 } }, a3: { promptTag: "test", llmPath: "codex-login-bridge", restaurants: [], precision: null, recall: null } } as never);
    expect(report).toContain("Codex login");
    expect(report).toContain("test-codex-model");
    expect(report).not.toContain("developer's Claude login");
  });
});
