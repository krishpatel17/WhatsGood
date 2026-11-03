import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app";
import { createRestaurant } from "../src/restaurants/repo";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const html = readFileSync(import.meta.dirname + "/fixtures/menu-easy.html", "utf8");

describe("US-03 Import a menu from a restaurant's website (API route)", () => {
  it("[ai] AC1/AC4 integration: POST /restaurants/:id/menu imports a menu URL so the team can load restaurants", async () => {
    const db = testDb();
    await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    const app = createApp({ db, blobs: memoryBlobs(), llm: mockLlm([easyMenu]), fetch: fakeFetch({ "https://t.example/menu": { body: html, contentType: "text/html" } }) });
    const post = (id: string, body: object) => app.request(`/restaurants/${id}/menu`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const res = await post("r1", { url: "https://t.example/menu" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "active", dishCount: 5 });
    expect((await post("r1", { url: "not a url" })).status).toBe(400);
    expect((await post("nope", { url: "https://t.example/menu" })).status).toBe(404);
  });
});
