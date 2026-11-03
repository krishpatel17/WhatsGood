import { z } from "zod";
import type { Blobs } from "../blobs";
import type { Db } from "../db";
import type { Llm, LlmContent, LlmMessage } from "../llm/types";
import { MENU_SCAN_SYSTEM } from "../prompts/menu-scan";
import { attemptLogger, MAX_ATTEMPTS, retryMessage, storeMenu } from "./import";
import { MenuSchema } from "./schema";
import { validateMenu } from "./validate";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
/** Types the vision model reads directly. HEIC is converted to JPEG by the web app before upload. */
export const VISION_TYPES = ["image/jpeg", "image/png"] as const;

export const RETAKE_MESSAGE = "We couldn't read a menu in that photo. Retake it in good light with the whole menu in the frame.";

export const ScanSchema = MenuSchema.extend({ is_menu: z.boolean(), legible: z.boolean() });

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!UPLOAD_TYPES.includes(file.type)) return "Upload a JPEG, PNG or HEIC photo.";
  if (file.size === 0) return "The photo is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The photo must be 10 MB or smaller.";
  return null;
}

export type ScanResult = { status: "retake"; message: string } | { status: "active" | "needs_review"; menuId: string; dishCount: number; attempts: number };

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function scanMenu(
  deps: { db: Db; blobs: Blobs; llm: Llm },
  input: { restaurantId: string; bytes: Uint8Array; mediaType: (typeof VISION_TYPES)[number] },
): Promise<ScanResult> {
  const content: LlmContent[] = [
    { type: "image", mediaType: input.mediaType, data: base64(input.bytes) },
    { type: "text", text: "SOURCE TYPE: photo" },
  ];
  const messages: LlmMessage[] = [{ role: "user", content }];
  // Photos have no page layout to count against, so only schema, duplicate and price checks apply.
  const validate = validateMenu(null);
  const log = attemptLogger(deps.db, input.restaurantId, null);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await deps.llm.json({ task: "menu_scan", system: MENU_SCAN_SYSTEM, messages, schema: ScanSchema, effort: "medium" });
    const scan = ScanSchema.safeParse(res.data);
    if (scan.success && (!scan.data.is_menu || !scan.data.legible || scan.data.dishes.length === 0)) {
      return { status: "retake", message: RETAKE_MESSAGE };
    }
    const { menu, errors } = validate(scan.success ? { dishes: scan.data.dishes } : res.data);
    await log(attempt, errors);
    if (menu && errors.length === 0) {
      return { ...(await save(deps, input, "active", attempt, menu.dishes)), attempts: attempt };
    }
    messages.push({ role: "assistant", content: res.raw }, { role: "user", content: retryMessage(attempt, errors) });
  }
  return { ...(await save(deps, input, "needs_review", MAX_ATTEMPTS, [])), attempts: MAX_ATTEMPTS };
}

async function save(
  deps: { db: Db; blobs: Blobs },
  input: { restaurantId: string; bytes: Uint8Array; mediaType: string },
  status: "active" | "needs_review",
  attempts: number,
  dishes: z.infer<typeof MenuSchema>["dishes"],
) {
  const snapshotKey = `photos/${input.restaurantId}/${Date.now()}`;
  await deps.blobs.put(snapshotKey, input.bytes, { httpMetadata: { contentType: input.mediaType } });
  const menuId = await storeMenu(deps.db, { restaurantId: input.restaurantId, sourceUrl: null, sourceType: "photo", snapshotKey, status, attempts, dishes });
  return { status, menuId, dishCount: dishes.length };
}
