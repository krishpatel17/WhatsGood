import { z } from "zod";
import { MODEL } from "./anthropic";
import type { Llm, LlmRequest, LlmResponse } from "./types";

/** The subscription bridge is for one developer's own machine, so only loopback addresses count. */
export function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** Sends model calls to scripts/subscription-bridge.ts, because a Worker can't launch the Claude CLI itself. */
export function bridgeLlm(opts: { url: string; provider?: "claude" | "codex"; model?: string; fetch?: typeof fetch }): Llm {
  const send = opts.fetch ?? fetch;
  const provider = opts.provider ?? "claude";
  const model = opts.model || (provider === "codex" ? "codex-cli-default" : MODEL);
  const responseSchema = z.object({ data: z.unknown(), raw: z.string(), usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() }), provider: z.enum(["claude", "codex"]).optional() });
  return {
    kind: "bridge",
    provider,
    model,
    async json(req: LlmRequest): Promise<LlmResponse> {
      const { schema, signal, ...rest } = req;
      // The CLI's schema checker rejects the draft URL Zod adds.
      const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(schema);
      const res = await send(`${opts.url.replace(/\/+$/, "")}/json`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...rest, provider, model, jsonSchema }),
      });
      const body = (await res.json().catch(() => ({}))) as LlmResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Bridge returned HTTP ${res.status}`);
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Invalid bridge response");
      if ((parsed.data.provider && parsed.data.provider !== provider) || (provider === "codex" && parsed.data.provider !== "codex")) throw new Error("Bridge response provider mismatch");
      return { data: parsed.data.data, raw: parsed.data.raw, usage: parsed.data.usage };
    },
  };
}
