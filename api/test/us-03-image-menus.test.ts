import { beforeEach, describe, expect, it } from "vitest";
import { importMenu } from "../src/menu/import";
import { findPageImages, MIN_MENU_IMAGE_BYTES } from "../src/menu/page-images";
import { createRestaurant } from "../src/restaurants/repo";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { fakeFetch, memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const PAGE = "https://dumplings.example/menu";
const bytes = (n: number) => new Uint8Array(n).fill(7);
const imagePage = `<html><body><img src="/logo.png"><h1>Menu</h1><img src="https://cdn.example/menu-big.png"><img src="https://cdn.example/menu-big.png"><img src="data:image/gif;base64,R0lGOD"></body></html>`;

describe("US-03 Import a menu: image-only menus go to the vision model (A2 v2)", () => {
  let db: ReturnType<typeof testDb>;
  beforeEach(async () => {
    db = testDb();
    await createRestaurant(db, { id: "r1", name: "Dumpling Place", address: "1 Main St" });
  });
  const run = (pages: Parameters<typeof fakeFetch>[0], llm: ReturnType<typeof mockLlm>) =>
    importMenu({ db, blobs: memoryBlobs(), llm, fetch: fakeFetch(pages) }, { restaurantId: "r1", url: PAGE });

  it("[ai] AC1 unit: finds each page image once, as absolute URLs, skipping inline data images", () => {
    expect(findPageImages(imagePage, PAGE)).toEqual(["https://dumplings.example/logo.png", "https://cdn.example/menu-big.png"]);
    expect(MIN_MENU_IMAGE_BYTES).toBe(100_000);
  });

  it("[ai] AC1 integration: a page with no menu text but a large image sends that image to the model", async () => {
    const llm = mockLlm([easyMenu]);
    const result = await run(
      {
        [PAGE]: { body: imagePage, contentType: "text/html" },
        "https://dumplings.example/logo.png": { body: bytes(20_000), contentType: "image/png" },
        "https://cdn.example/menu-big.png": { body: bytes(300_000), contentType: "image/png" },
      },
      llm,
    );
    expect(result).toMatchObject({ status: "active", dishCount: 5 });
    const content = llm.calls[0].messages[0].content as { type: string; mediaType?: string }[];
    const images = content.filter((c) => c.type === "image");
    expect(images).toHaveLength(1); // the logo is too small to be a menu
    expect(images[0].mediaType).toBe("image/png");
  });

  it("[ai] AC1 integration: a page that already has a text menu does not fetch its images", async () => {
    const textMenu = `<p>Dan Dan Noodles $14</p><p>Pork Dumplings $9</p><p>Cumin Lamb $16.50</p><p>Bok Choy $12</p><p>Veg Dumplings $8</p><img src="https://cdn.example/menu-big.png">`;
    const llm = mockLlm([easyMenu]);
    await run({ [PAGE]: { body: textMenu, contentType: "text/html" } }, llm);
    const content = llm.calls[0].messages[0].content as { type: string }[];
    expect(content.some((c) => c.type === "image")).toBe(false);
  });

  it("[ai] AC1 integration: if no image is large enough or the images can't be fetched, the page text is sent as before", async () => {
    const llm = mockLlm([{ dishes: [] }]);
    const result = await run({ [PAGE]: { body: imagePage, contentType: "text/html" }, "https://dumplings.example/logo.png": { body: bytes(20_000), contentType: "image/png" } }, llm);
    const content = llm.calls[0].messages[0].content as { type: string }[];
    expect(content.some((c) => c.type === "image")).toBe(false);
    expect(result.status).toBe("needs_review");
  });
});
