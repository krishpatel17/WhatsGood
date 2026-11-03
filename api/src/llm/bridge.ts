import { z } from "zod";
import type { Llm, LlmRequest, LlmResponse } from "./types";

/** The subscription bridge is for one developer's own machine, so only loopback addresses count. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Sends model calls to scripts/subscription-bridge.ts, because a Worker can't launch the Claude CLI itself. */
export function bridgeLlm(opts: { url: string; fetch?: typeof fetch }): Llm {
  const send = opts.fetch ?? fetch;
  return {
    kind: "bridge",
    async json(req: LlmRequest): Promise<LlmResponse> {
      const { schema, ...rest } = req;
      // The CLI's schema checker rejects the draft URL Zod adds.
      const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema);
      const res = await send(`${opts.url}/json`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...rest, jsonSchema }),
      });
      const body = (await res.json().catch(() => ({}))) as LlmResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Bridge returned HTTP ${res.status}`);
      return { data: body.data, raw: body.raw, usage: body.usage };
    },
  };
}
