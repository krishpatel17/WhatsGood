// Scripted stand-in for the Claude API. Each call returns the next scripted
// response; { raw } simulates output that is not valid JSON.
import type { Llm, LlmRequest } from "../../src/llm/types";

type Scripted = unknown | { raw: string } | ((req: LlmRequest) => unknown);

export function mockLlm(responses: Scripted[]) {
  const calls: LlmRequest[] = [];
  const llm: Llm & { calls: LlmRequest[] } = {
    calls,
    async json(req) {
      calls.push({ ...req, messages: structuredClone(req.messages) });
      if (calls.length > responses.length) throw new Error(`mockLlm: unexpected call #${calls.length} (${req.task})`);
      let next = responses[calls.length - 1];
      if (typeof next === "function") next = (next as (r: LlmRequest) => unknown)(req);
      const usage = { input_tokens: 1000, output_tokens: 200 };
      if (next && typeof next === "object" && "raw" in next) {
        const raw = (next as { raw: string }).raw;
        let data: unknown = null;
        try {
          data = JSON.parse(raw);
        } catch {}
        return { data, raw, usage };
      }
      return { data: next, raw: JSON.stringify(next), usage };
    },
  };
  return llm;
}
