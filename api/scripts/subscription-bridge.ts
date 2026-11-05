// Local-only: lets `wrangler dev` and the benchmark scripts use the developer's own Claude login
// instead of an API key. For one person on their own machine. Never deploy it or share it with
// other users. Validation results record that a run went through it.
// Usage: npm run bridge -w api   (then set LLM_BRIDGE_URL=http://127.0.0.1:8790 in api/.dev.vars)
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { LlmMessage, LlmResponse } from "../src/llm/types";

export const BRIDGE_PORT = 8790;

export type BridgeRequest = {
  provider?: "claude" | "codex";
  task: string;
  system: string;
  messages: LlmMessage[];
  model?: string;
  jsonSchema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
};

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

/** The CLI takes one user turn, so earlier turns of a retry are folded into it as text. */
export function toUserContent(messages: LlmMessage[]): Block[] {
  return messages.flatMap((m): Block[] => {
    if (m.role === "assistant") return [{ type: "text", text: `Your previous answer was:\n${typeof m.content === "string" ? m.content : ""}` }];
    if (typeof m.content === "string") return [{ type: "text", text: m.content }];
    return m.content.map((c): Block => {
      if (c.type === "text") return c;
      if (c.type === "image") return { type: "image", source: { type: "base64", media_type: c.mediaType, data: c.data } };
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data: c.data } };
    });
  });
}

export const MAX_BRIDGE_BODY_BYTES = 12 * 1024 * 1024;
const blockSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("text"),text:z.string()}),
  z.object({type:z.literal("image"),mediaType:z.enum(["image/jpeg","image/png","image/gif","image/webp"]),data:z.string()}),
  z.object({type:z.literal("pdf"),data:z.string()}),
]);
const requestSchema = z.object({
  provider:z.enum(["claude","codex"]).optional(),
  task:z.string().min(1), system:z.string(),
  messages:z.array(z.object({role:z.enum(["user","assistant"]),content:z.union([z.string(),z.array(blockSchema)])})),
  model:z.string().min(1).optional(), jsonSchema:z.record(z.string(),z.unknown()),
  effort:z.enum(["low","medium","high"]).optional(),
});
class RequestError extends Error { constructor(public status: number, message: string) { super(message); } }
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve,reject) => {
    const chunks:Buffer[]=[]; let size=0;
    req.on("data", (chunk:Buffer) => {
      size += chunk.length;
      if (size > MAX_BRIDGE_BODY_BYTES) {
        chunks.length=0;
        reject(new RequestError(413,"Request body too large."));
      } else chunks.push(chunk);
    });
    req.once("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));
    req.once("error",reject);
    req.once("aborted",()=>reject(new RequestError(400,"Request aborted.")));
  });
}

/**
 * Requiring JSON and no Origin stops a web page from spending the subscription: browsers
 * add Origin to cross-site POSTs, and a JSON body needs a preflight this server never grants.
 */
export function createBridge(run: (req: BridgeRequest, signal: AbortSignal) => Promise<LlmResponse>, options: { provider?: "claude" | "codex" } = {}) {
  return createServer(async (req, res) => {
    const controller = new AbortController();
    res.once("close", () => { if (!res.writableEnded) controller.abort(); });
    const reply = (status: number, body: unknown) => {
      if (res.destroyed || controller.signal.aborted) return;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.origin) return reply(403, { error: "Local API calls only." });
    if (req.method === "GET" && req.url === "/health") return reply(200, { ok: true, provider: options.provider ?? "claude" });
    if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return reply(403, { error: "Local API calls only." });
    if (req.method !== "POST" || req.url !== "/json") return reply(404, { error: "Not found." });
    try {
      const body = await readBody(req);
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { throw new RequestError(400, "Malformed JSON."); }
      const valid = requestSchema.safeParse(parsed);
      if (!valid.success) throw new RequestError(400, "Invalid bridge request.");
      const provider = options.provider ?? "claude";
      if ((valid.data.provider && valid.data.provider !== provider) || (provider === "codex" && valid.data.provider !== "codex")) throw new RequestError(400, "Bridge provider mismatch. Set LLM_BRIDGE_PROVIDER to the server's provider.");
      if (controller.signal.aborted) return;
      const result = await run(valid.data, controller.signal);
      reply(200, options.provider ? { ...result, provider } : result);
    } catch (e) {
      reply(e instanceof RequestError ? e.status : 502, { error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/** One isolated model call: no tools, no project or user settings, no MCP connectors, nothing saved. */
export async function runWithSubscription(req: BridgeRequest, signal?: AbortSignal): Promise<LlmResponse> {
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  // An API key in the environment would take priority over the login.
  const { ANTHROPIC_API_KEY: _ignored, ...env } = process.env;
  async function* prompt() {
    yield { type: "user" as const, parent_tool_use_id: null, session_id: "", message: { role: "user" as const, content: toUserContent(req.messages) } };
  }
  try {
  for await (const msg of query({
    prompt: prompt() as never,
    options: {
      model: req.model,
      abortController,
      systemPrompt: req.system,
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      effort: req.effort ?? "medium",
      outputFormat: { type: "json_schema", schema: req.jsonSchema },
      env,
    },
  })) {
    if (msg.type !== "result") continue;
    // Harness failures such as a missing login arrive with subtype "success" and is_error set.
    if (msg.is_error || msg.subtype !== "success") throw new Error(msg.subtype === "success" ? msg.result : `Model run failed: ${msg.subtype}`);
    return {
      data: msg.structured_output ?? null,
      raw: msg.structured_output === undefined ? msg.result : JSON.stringify(msg.structured_output),
      usage: { input_tokens: msg.usage.input_tokens + msg.usage.cache_read_input_tokens + msg.usage.cache_creation_input_tokens, output_tokens: msg.usage.output_tokens },
    };
  }
  throw new Error("The model run ended without a result.");
  } finally { signal?.removeEventListener("abort", abort); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createBridge((req, signal) => {
    console.log(`${new Date().toISOString()} ${req.task}`);
    return runWithSubscription(req, signal);
  }, { provider: "claude" }).listen(BRIDGE_PORT, "127.0.0.1", () => console.log(`Claude subscription bridge on http://127.0.0.1:${BRIDGE_PORT} (local use only)`));
}
