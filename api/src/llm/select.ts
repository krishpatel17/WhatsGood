import { anthropicLlm } from "./anthropic";
import { bridgeLlm, isLoopbackUrl } from "./bridge";
import type { Llm } from "./types";

/** Legacy URLs select Claude; explicit configurations never silently fall back to the API. */
export function selectLlm(opts: { apiKey?: string; bridgeUrl?: string; bridgeProvider?: string; bridgeModel?: string }): Llm {
  if (opts.bridgeProvider && !["claude", "codex"].includes(opts.bridgeProvider)) throw new Error("Unknown LLM_BRIDGE_PROVIDER; use claude or codex");
  if (opts.bridgeProvider && !opts.bridgeUrl) throw new Error("LLM_BRIDGE_URL is required when a bridge provider is selected");
  if (opts.bridgeProvider && !isLoopbackUrl(opts.bridgeUrl!)) throw new Error("An explicit bridge must use a loopback HTTP(S) URL");
  if (opts.bridgeUrl && isLoopbackUrl(opts.bridgeUrl)) return bridgeLlm({ url: opts.bridgeUrl, provider: (opts.bridgeProvider ?? "claude") as "claude" | "codex", model: opts.bridgeModel, fetch: (input, init) => fetch(input, init) });
  return anthropicLlm({ apiKey: opts.apiKey });
}

export type LlmPath = "claude-login-bridge" | "codex-login-bridge" | "anthropic-api";

/** Recorded with validation results, so a report can say how its model calls were made. */
export const llmPath = (llm: Llm): LlmPath => (llm.kind === "bridge" ? llm.provider === "codex" ? "codex-login-bridge" : "claude-login-bridge" : "anthropic-api");
