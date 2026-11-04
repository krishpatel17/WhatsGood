// Render JavaScript menu pages in a browser before import (A2 v2). Ordering sites build their
// menu with JavaScript after the page loads, so a plain download sees an empty shell.
// The browser itself is supplied by the caller: Playwright locally (src/validation/playwright-render.ts);
// a deployed Worker would need Cloudflare Browser Rendering (Beta).
import { htmlToText, pickExtractor } from "./fetcher";

export type Render = (url: string) => Promise<{ html: string; finalUrl: string }>;

// Fewer priced lines than this means the downloaded page probably isn't showing its menu.
export const MIN_PRICES = 5;
const BLOCKED = [401, 403, 429, 503];
const PRICE = /\$\s?\d{1,3}(\.\d{2})?|\b\d{1,3}\.\d{2}\b/g;

const priceCount = (html: string) => (htmlToText(html).match(PRICE) ?? []).length;

/** Render when the page is a known ordering site, was blocked, or shows almost no prices. */
export function needsRender(url: string, status: number, html: string): boolean {
  if (BLOCKED.includes(status)) return true;
  if (status < 200 || status >= 300) return false;
  if (pickExtractor(url, "text/html") === "ordering-page") return true;
  return priceCount(html) < MIN_PRICES;
}

/** A fetch that swaps an HTML page for its rendered version when that shows more of the menu. */
export function renderingFetch(inner: typeof fetch, render: Render): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const res = await inner(input, init);
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !type.includes("text/html")) return res;
    const body = await res.text();
    const original = () => new Response(body, { status: res.status, headers: res.headers });
    if (!needsRender(url, res.status, body)) return original();
    try {
      const rendered = await render(url);
      if (priceCount(rendered.html) <= (res.ok ? priceCount(body) : -1)) return original();
      return new Response(rendered.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return original();
    }
  }) as typeof fetch;
}
