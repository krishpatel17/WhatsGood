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

  it("[ai] a page with no dishes is reported as a failed import and the existing menu stays in place", async () => {
    const db = testDb();
    await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    const pages = fakeFetch({
      "https://t.example/menu": { body: html, contentType: "text/html" },
      "https://t.example/eat": { body: "<html><body><h1>The Food</h1><div id='menu'></div></body></html>", contentType: "text/html" },
    });
    const app = createApp({ db, blobs: memoryBlobs(), llm: mockLlm([easyMenu, { dishes: [] }]), fetch: pages });
    const post = (url: string) => app.request("/restaurants/r1/menu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });

    expect((await post("https://t.example/menu")).status).toBe(201);
    const res = await post("https://t.example/eat");
    expect(res.status).toBe(422);
    const body = (await res.json()) as { status: string; dishCount: number; error: string };
    expect(body).toMatchObject({ status: "needs_review", dishCount: 0 });
    expect(body.error).toMatch(/no dishes/i);
    expect(body.error).toMatch(/javascript/i);

    const restaurant = (await (await app.request("/restaurants/r1")).json()) as { has_menu: unknown };
    expect(restaurant.has_menu).toBeTruthy();
  });

  it("[ai] a menu that keeps failing validation is also reported as a failed import, with the failed check", async () => {
    const db = testDb();
    await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    const tooFew = { dishes: easyMenu.dishes.slice(0, 2) };
    const app = createApp({ db, blobs: memoryBlobs(), llm: mockLlm([tooFew, tooFew, tooFew]), fetch: fakeFetch({ "https://t.example/menu": { body: html, contentType: "text/html" } }) });
    const res = await app.request("/restaurants/r1/menu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://t.example/menu" }) });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toContain("item count 2 is not within 15%");
  });
});
