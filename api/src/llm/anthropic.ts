import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Llm, LlmContent, LlmMessage, LlmRequest, LlmResponse } from "./types";

export const MODEL = "claude-opus-5-5";

function toBlocks(content: LlmMessage["content"]): Anthropic.Beta.BetaContentBlockParam[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((c: LlmContent): Anthropic.Beta.BetaContentBlockParam => {
    if (c.type === "text") return { type: "text", text: c.text };
    if (c.type === "image") return { type: "image", source: { type: "base64", media_type: c.mediaType, data: c.data } };
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: c.data } };
  });
}

/** Claude-backed implementation of the Llm interface (structured JSON output). */
export function anthropicLlm(opts: { apiKey?: string; fetch?: typeof fetch } = {}): Llm {
  const client = new Anthropic({ apiKey: opts.apiKey, fetch: opts.fetch });
  return {
    async json(req: LlmRequest): Promise<LlmResponse> {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: toBlocks(m.content) })),
        output_config: { effort: req.effort ?? "medium", format: zodOutputFormat(req.schema) },
      });
      const raw = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const usage = { input_tokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0), output_tokens: response.usage.output_tokens };
      if (response.stop_reason === "refusal") return { data: null, raw: `REFUSED: ${raw}`, usage };
      return { data: response.parsed_output ?? null, raw, usage };
    },
  };
}
