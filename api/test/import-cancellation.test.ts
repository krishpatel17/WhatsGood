import { expect, it, vi } from "vitest";
import { z } from "zod";
import { importMenu } from "../src/menu/import";
import { bridgeLlm } from "../src/llm/bridge";
import { localDb } from "../src/validation/localdb";
import { createRestaurant } from "../src/restaurants/repo";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { mockLlm } from "./helpers/llm";

it("[ai] an aborted import cannot log or store a late model result", async () => {
  const db = localDb();
  await createRestaurant(db, { id: "r", name: "Cafe", address: "Main" });
  let release!: (value: unknown) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const llm = mockLlm([() => { entered(); return new Promise((resolve) => { release = resolve; }); }]);
  const controller = new AbortController();
  const url = "https://cafe.example/menu";
  const pending = importMenu({ db, blobs: memoryBlobs(), llm, signal: controller.signal,
    fetch: fakeFetch({ [url]: { body: "Soup $6", contentType: "text/html" } }),
  }, { restaurantId: "r", url });
  await started;
  controller.abort(new Error("deadline"));
  release({ dishes: [{ name: "Soup", section: "Mains", price: 6, description: null, tags: [] }] });
  await expect(pending).rejects.toThrow("deadline");
  expect(llm.calls[0].signal).toBe(controller.signal);
  expect(db.raw.prepare("SELECT count(*) AS n FROM menus").get()).toMatchObject({ n: 0 });
  expect(db.raw.prepare("SELECT count(*) AS n FROM menu_import_attempts").get()).toMatchObject({ n: 0 });
  db.raw.close();
});

it("[ai] bridge cancellation is passed to HTTP rather than serialized into the model request", async () => {
  const controller = new AbortController();
  const send = vi.fn(async (_input: unknown, init?: RequestInit) => {
    expect(init?.signal).toBe(controller.signal);
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("signal");
    return new Response(JSON.stringify({ data: {}, raw: "{}", usage: { input_tokens: 0, output_tokens: 0 } }));
  });
  await bridgeLlm({ url: "http://localhost:8790", fetch: send as typeof fetch }).json({
    task: "menu_import", system: "read", messages: [], schema: z.object({}), signal: controller.signal,
  });
  expect(send).toHaveBeenCalledOnce();
});
