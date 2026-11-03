import { beforeEach, describe, expect, it } from "vitest";
import { RETAKE_MESSAGE, scanMenu, validateUpload } from "../src/menu/scan";
import { createRestaurant, getRestaurant } from "../src/restaurants/repo";
import { createApp } from "../src/app";
import { testDb } from "./helpers/db";
import { mockLlm } from "./helpers/llm";
import { memoryBlobs } from "./helpers/blobs";
import { easyMenu } from "./fixtures/menus";

const MB = 1024 * 1024;
// A few bytes standing in for a JPEG; the vision response is mocked.
const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe("US-04 Scan a menu photo", () => {
  it("[ai] T1 unit: upload rejects files over 10 MB and unsupported types", () => {
    expect(validateUpload({ type: "image/jpeg", size: 2 * MB })).toBeNull();
    expect(validateUpload({ type: "image/png", size: 10 * MB })).toBeNull();
    expect(validateUpload({ type: "image/heic", size: 3 * MB })).toBeNull();
    expect(validateUpload({ type: "image/jpeg", size: 10 * MB + 1 })).toMatch(/10 MB/);
    expect(validateUpload({ type: "application/pdf", size: MB })).toMatch(/JPEG, PNG or HEIC/);
    expect(validateUpload({ type: "image/gif", size: MB })).toMatch(/JPEG, PNG or HEIC/);
    expect(validateUpload({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
  });

  describe("scanning", () => {
    let db: ReturnType<typeof testDb>;
    let blobs: ReturnType<typeof memoryBlobs>;
    beforeEach(async () => {
      db = testDb();
      blobs = memoryBlobs();
      await createRestaurant(db, { id: "r1", name: "Test Noodle House", address: "1 Main St" });
    });

    it("[ai] T2 integration: a photo fixture (mocked vision response) produces a schema-valid menu linked to the restaurant", async () => {
      const llm = mockLlm([{ is_menu: true, legible: true, ...easyMenu }]);
      const result = await scanMenu({ db, blobs, llm }, { restaurantId: "r1", bytes: photo, mediaType: "image/jpeg" });
      expect(result).toMatchObject({ status: "active", dishCount: 5 });
      const menu = db.raw.prepare("SELECT restaurant_id, source_type, snapshot_key, status FROM menus").get() as Record<string, string>;
      expect(menu).toMatchObject({ restaurant_id: "r1", source_type: "photo", status: "active" });
      expect(blobs.store.get(menu.snapshot_key)?.contentType).toBe("image/jpeg");
      expect((await getRestaurant(db, "r1"))!.has_menu).toBe(true);
      expect(llm.calls[0].messages[0].content).toContainEqual(expect.objectContaining({ type: "image", mediaType: "image/jpeg" }));
    });

    it("[ai] T3 unit: a low-confidence / zero-item response maps to the retake message", async () => {
      for (const response of [
        { is_menu: false, legible: true, dishes: [] },
        { is_menu: true, legible: false, ...easyMenu },
        { is_menu: true, legible: true, dishes: [] },
      ]) {
        const result = await scanMenu({ db, blobs, llm: mockLlm([response]) }, { restaurantId: "r1", bytes: photo, mediaType: "image/jpeg" });
        expect(result).toEqual({ status: "retake", message: RETAKE_MESSAGE });
      }
      expect(db.raw.prepare("SELECT COUNT(*) AS n FROM menus").get()).toEqual({ n: 0 });
    });

    it("[ai] AC1/AC4 integration: POST /restaurants/:id/scan accepts a multipart photo and rejects a bad upload", async () => {
      const app = createApp({ db, blobs, llm: mockLlm([{ is_menu: true, legible: true, ...easyMenu }]) });
      const form = new FormData();
      form.append("photo", new File([photo], "menu.jpg", { type: "image/jpeg" }));
      const ok = await app.request("/restaurants/r1/scan", { method: "POST", body: form });
      expect(ok.status).toBe(201);
      expect(await ok.json()).toMatchObject({ status: "active", dishCount: 5 });

      const bad = new FormData();
      bad.append("photo", new File([photo], "menu.gif", { type: "image/gif" }));
      expect((await app.request("/restaurants/r1/scan", { method: "POST", body: bad })).status).toBe(400);
      expect((await app.request("/restaurants/missing/scan", { method: "POST", body: form })).status).toBe(404);
    });
  });
});
