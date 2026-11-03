import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBridge, toUserContent } from "../scripts/subscription-bridge";
import { depsFromEnv } from "../src/app";
import { bridgeLlm, isLoopbackUrl } from "../src/llm/bridge";

const schema = z.object({ picks: z.array(z.string()) });
const answer = { data: { picks: ["Dan Dan Noodles"] }, raw: '{"picks":["Dan Dan Noodles"]}', usage: { input_tokens: 10, output_tokens: 5 } };

describe("Local subscription bridge", () => {
  const servers: ReturnType<typeof createBridge>[] = [];
  afterEach(() => servers.splice(0).forEach((s) => s.close()));

  async function start(run: Parameters<typeof createBridge>[0]) {
    const server = createBridge(run);
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("[ai] T1 unit: the client sends the request with a JSON schema and returns the answer", async () => {
    let sent: { url: string; body: Record<string, unknown> } | undefined;
    const llm = bridgeLlm({
      url: "http://127.0.0.1:8790",
      fetch: async (url, init) => {
        sent = { url: String(url), body: JSON.parse(String(init?.body)) };
        return Response.json(answer);
      },
    });
    const out = await llm.json({ task: "recommend", system: "sys", messages: [{ role: "user", content: "hi" }], schema, effort: "low" });
    expect(out).toEqual(answer);
    expect(sent?.url).toBe("http://127.0.0.1:8790/json");
    expect(sent?.body).toMatchObject({ task: "recommend", system: "sys", effort: "low", jsonSchema: { type: "object" } });
    expect(sent?.body.jsonSchema).not.toHaveProperty("$schema");
  });

  it("[ai] T2 unit: a bridge failure throws so callers can fall back", async () => {
    const llm = bridgeLlm({ url: "http://127.0.0.1:8790", fetch: async () => Response.json({ error: "not logged in" }, { status: 502 }) });
    await expect(llm.json({ task: "t", system: "s", messages: [], schema })).rejects.toThrow("not logged in");
  });

  it("[ai] T3 unit: only loopback addresses count, so a deployment can't use it", () => {
    expect(isLoopbackUrl("http://127.0.0.1:8790")).toBe(true);
    expect(isLoopbackUrl("http://localhost:8790")).toBe(true);
    expect(isLoopbackUrl("https://bridge.example.com")).toBe(false);
    expect(isLoopbackUrl("http://127.0.0.1.example.com")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });

  it("[ai] T4 unit: the Worker uses the bridge only for a loopback LLM_BRIDGE_URL", async () => {
    const env = (LLM_BRIDGE_URL?: string) => ({ DB: {}, BUCKET: {}, ANTHROPIC_API_KEY: "test", LLM_BRIDGE_URL }) as never;
    expect(depsFromEnv(env("http://127.0.0.1:8790")).llm?.kind).toBe("bridge");
    expect(depsFromEnv(env()).llm?.kind).toBeUndefined();
    expect(depsFromEnv(env("https://bridge.example.com")).llm?.kind).toBeUndefined();
  });

  it("[ai] T5 integration: the bridge answers a JSON request", async () => {
    const base = await start(async (req) => ({ ...answer, raw: req.task }));
    const res = await fetch(`${base}/json`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "menu_import", system: "s", messages: [], jsonSchema: {} }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...answer, raw: "menu_import" });
  });

  it("[ai] T6 integration: requests from web pages are refused, so a site can't spend the subscription", async () => {
    let calls = 0;
    const base = await start(async () => {
      calls++;
      return answer;
    });
    const fromPage = await fetch(`${base}/json`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    const simple = await fetch(`${base}/json`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect([fromPage.status, simple.status]).toEqual([403, 403]);
    expect(calls).toBe(0);
  });

  it("[ai] T7 integration: a failed model run becomes a 502 with the reason", async () => {
    const base = await start(async () => {
      throw new Error("not logged in");
    });
    const res = await fetch(`${base}/json`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "not logged in" });
  });

  it("[ai] T8 unit: images, PDFs and retry feedback all reach the model in order", () => {
    const blocks = toUserContent([
      {
        role: "user",
        content: [
          { type: "text", text: "Read this" },
          { type: "image", mediaType: "image/png", data: "aW1n" },
          { type: "pdf", data: "cGRm" },
        ],
      },
      { role: "assistant", content: '{"picks":[]}' },
      { role: "user", content: "VALIDATION FAILED" },
    ]);
    expect(blocks).toEqual([
      { type: "text", text: "Read this" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1n" } },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "cGRm" } },
      { type: "text", text: 'Your previous answer was:\n{"picks":[]}' },
      { type: "text", text: "VALIDATION FAILED" },
    ]);
  });
});
