import { anthropicLlm } from "./anthropic";
import { bridgeLlm, isLoopbackUrl } from "./bridge";
import type { Llm } from "./types";

/** The local Claude login bridge when a loopback URL is set, otherwise the API. */
export function selectLlm(opts: { apiKey?: string; bridgeUrl?: string }): Llm {
  if (opts.bridgeUrl && isLoopbackUrl(opts.bridgeUrl)) return bridgeLlm({ url: opts.bridgeUrl, fetch: (input, init) => fetch(input, init) });
  return anthropicLlm({ apiKey: opts.apiKey });
}

export type LlmPath = "claude-login-bridge" | "anthropic-api";

/** Recorded with validation results, so a report can say how its model calls were made. */
export const llmPath = (llm: Llm): LlmPath => (llm.kind === "bridge" ? "claude-login-bridge" : "anthropic-api");
