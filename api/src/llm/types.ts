import type { z } from "zod";

export type LlmContent =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string }
  | { type: "pdf"; data: string };

export type LlmMessage = { role: "user" | "assistant"; content: string | LlmContent[] };

export type LlmUsage = { input_tokens: number; output_tokens: number };

export type LlmRequest = {
  /** Short name used in logs and cost reports, e.g. "menu_import". */
  task: string;
  system: string;
  messages: LlmMessage[];
  /** Shape the model is asked to produce. Callers still validate the result themselves. */
  schema: z.ZodType;
  effort?: "low" | "medium" | "high";
};

export type LlmResponse = {
  /** Parsed JSON, or null when the output was not JSON. Never trusted without validation. */
  data: unknown;
  raw: string;
  usage: LlmUsage;
};

export interface Llm {
  kind?: "bridge";
  json(req: LlmRequest): Promise<LlmResponse>;
}
