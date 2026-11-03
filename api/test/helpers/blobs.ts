// In-memory stand-in for the R2 bucket.
import type { Blobs } from "../../src/blobs";

export function memoryBlobs() {
  const store = new Map<string, { body: Uint8Array; contentType?: string }>();
  const blobs: Blobs & { store: typeof store } = {
    store,
    async put(key, value, opts) {
      const body = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
      store.set(key, { body, contentType: opts?.httpMetadata?.contentType });
      return null;
    },
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      return { arrayBuffer: async () => hit.body.slice().buffer, text: async () => new TextDecoder().decode(hit.body) };
    },
  };
  return blobs;
}

export function fakeFetch(pages: Record<string, { body: string | Uint8Array; contentType: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    const page = pages[url];
    if (!page) return new Response("not found", { status: 404 });
    return new Response(page.body, { headers: { "content-type": page.contentType } });
  }) as typeof fetch;
}
