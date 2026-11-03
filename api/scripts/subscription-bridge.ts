// Local-only: lets `wrangler dev` use the developer's own Claude login instead of an API key.
// For one person trying the app on their own machine. Never deploy it or share it with other
// users: real users, demos on other machines and the A2/A3 benchmarks need an API key.
// Usage: npm run bridge -w api   (then set LLM_BRIDGE_URL=http://127.0.0.1:8790 in api/.dev.vars)
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import type { LlmMessage, LlmResponse } from "../src/llm/types";

export const BRIDGE_PORT = 8790;

export type BridgeRequest = {
  task: string;
  system: string;
  messages: LlmMessage[];
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

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

/**
 * Requiring JSON and no Origin stops a web page from spending the subscription: browsers
 * add Origin to cross-site POSTs, and a JSON body needs a preflight this server never grants.
 */
export function createBridge(run: (req: BridgeRequest) => Promise<LlmResponse>) {
  return createServer(async (req, res) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.origin || !req.headers["content-type"]?.startsWith("application/json")) return reply(403, { error: "Local API calls only." });
    if (req.method !== "POST" || req.url !== "/json") return reply(404, { error: "Not found." });
    try {
      reply(200, await run(JSON.parse(await readBody(req)) as BridgeRequest));
    } catch (e) {
      reply(502, { error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/** One isolated model call: no tools, no project or user settings, no MCP connectors, nothing saved. */
async function runWithSubscription(req: BridgeRequest): Promise<LlmResponse> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  // An API key in the environment would take priority over the login.
  const { ANTHROPIC_API_KEY: _ignored, ...env } = process.env;
  async function* prompt() {
    yield { type: "user" as const, parent_tool_use_id: null, session_id: "", message: { role: "user" as const, content: toUserContent(req.messages) } };
  }
  for await (const msg of query({
    prompt: prompt() as never,
    options: {
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
      usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
    };
  }
  throw new Error("The model run ended without a result.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createBridge((req) => {
    console.log(`${new Date().toISOString()} ${req.task}`);
    return runWithSubscription(req);
  }).listen(BRIDGE_PORT, "127.0.0.1", () => console.log(`Subscription bridge on http://127.0.0.1:${BRIDGE_PORT} (local use only)`));
}
