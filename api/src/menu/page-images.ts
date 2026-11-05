// Some restaurants post their menu as a picture on an otherwise empty page. When a page has
// almost no menu text, its largest images go to the vision model instead (A2 v2).
import type { LlmContent } from "../llm/types";
import { base64, fetchSource } from "./fetcher";

// Logos and icons are small; a legible full menu is not.
export const MIN_MENU_IMAGE_BYTES = 100_000;
// Claude's limit for one image.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MENU_IMAGES = 2;
const MAX_CANDIDATES = 10;
const VISION_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** Every distinct <img> on the page as an absolute URL, skipping inline data images. */
export function findPageImages(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const src = m[1].replace(/&amp;/g, "&");
    if (src.startsWith("data:")) continue;
    try {
      urls.push(new URL(src, pageUrl).href);
    } catch {
      // A malformed src is not a menu.
    }
  }
  return [...new Set(urls)];
}

/** Downloads the candidates and keeps the largest images big enough to be a menu, as vision content. */
export async function fetchMenuImages(fetcher: typeof fetch, urls: string[]): Promise<LlmContent[]> {
  const found: { mediaType: (typeof VISION_TYPES)[number]; bytes: Uint8Array }[] = [];
  for (const url of urls.slice(0, MAX_CANDIDATES)) {
    try {
      const src = await fetchSource(fetcher, url);
      const mediaType = VISION_TYPES.find((t) => src.contentType.startsWith(t));
      if (!mediaType) continue;
      const bytes = src.bytes;
      if (bytes.length >= MIN_MENU_IMAGE_BYTES && bytes.length <= MAX_IMAGE_BYTES) found.push({ mediaType, bytes });
    } catch {
      // An image that can't be fetched is skipped.
    }
  }
  return found
    .sort((a, b) => b.bytes.length - a.bytes.length)
    .slice(0, MAX_MENU_IMAGES)
    .map((img) => ({ type: "image" as const, mediaType: img.mediaType, data: base64(img.bytes) }));
}
