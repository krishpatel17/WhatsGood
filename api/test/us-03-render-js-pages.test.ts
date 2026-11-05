import { describe, expect, it } from "vitest";
import { renderingFetch, needsRender, type Render } from "../src/menu/render";
import { copySourceUrl, fetchSource } from "../src/menu/fetcher";
import { findPageImages } from "../src/menu/page-images";

const menuHtml = "<h1>Menu</h1>" + ["Burger $12", "Fries $4", "Salad $9.50", "Soup $6", "Wrap $10", "Tacos $11"].map((d) => `<p>${d}</p>`).join("");
const emptyShell = '<html><body><div id="root"></div><script>window.app()</script></body></html>';

function fakeFetch(pages: Record<string, { status?: number; body: string; type?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const p = pages[String(input)];
    if (!p) return new Response("not found", { status: 404 });
    return new Response(p.body, { status: p.status ?? 200, headers: { "content-type": p.type ?? "text/html" } });
  }) as typeof fetch;
}

function fakeRender(html: string | Error): Render & { calls: string[] } {
  const calls: string[] = [];
  const render = (async (url: string) => {
    calls.push(url);
    if (html instanceof Error) throw html;
    return { html, finalUrl: url };
  }) as Render & { calls: string[] };
  render.calls = calls;
  return render;
}

describe("US-03 Import a menu: render JavaScript pages before reading them (A2 v2)", () => {
  it.each([false, true])("[ai] preserves browser redirects through response wrappers (%s)", async (wrap) => {
    const url = "https://cafe.example/menu";
    const finalUrl = "https://cafe.square.site/dinner/";
    const f = renderingFetch(fakeFetch({ [url]: { body: emptyShell } }), async () => ({
      html: menuHtml + '<img src="menu.png" width="1200" height="1800">', finalUrl,
    }));
    const wrapped: typeof fetch = async (input, init) => {
      const response = await f(input, init);
      return copySourceUrl(response, new Response(await response.arrayBuffer(), { headers: response.headers }));
    };
    const src = await fetchSource(wrap ? wrapped : f, url);
    expect(src).toMatchObject({ url: finalUrl, kind: "ordering-page" });
    expect(findPageImages(new TextDecoder().decode(src.bytes), src.url)).toContain("https://cafe.square.site/dinner/menu.png");
  });
  it("[ai] rejects private browser destinations and retains the original page", async () => {
    const url = "https://cafe.example/menu";
    const f = renderingFetch(fakeFetch({ [url]: { body: emptyShell } }), async () => ({ html: menuHtml, finalUrl: "http://127.0.0.1/menu" }));
    const src = await fetchSource(f, url);
    expect(src.url).toBe(url);
    expect(new TextDecoder().decode(src.bytes)).toBe(emptyShell);
  });
  it("[ai] AC1 unit: decides to render known ordering sites, blocked pages and pages with almost no prices", () => {
    expect(needsRender("https://order.chownow.com/order/1/locations", 200, emptyShell)).toBe(true);
    expect(needsRender("https://cafe.example/menu", 403, "Forbidden")).toBe(true);
    expect(needsRender("https://cafe.example/menu", 200, emptyShell)).toBe(true);
    expect(needsRender("https://cafe.example/menu", 200, menuHtml)).toBe(false);
    expect(needsRender("https://cafe.example/menu", 404, "Not found")).toBe(false);
  });

  it("[ai] AC1 integration: an empty JavaScript shell is replaced by the rendered page", async () => {
    const render = fakeRender(menuHtml);
    const f = renderingFetch(fakeFetch({ "https://cafe.example/menu": { body: emptyShell } }), render);
    const res = await f("https://cafe.example/menu");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toBe(menuHtml);
    expect(render.calls).toEqual(["https://cafe.example/menu"]);
  });

  it("[ai] AC1 integration: a page that already has a text menu is not rendered", async () => {
    const render = fakeRender("<p>should not be used</p>");
    const f = renderingFetch(fakeFetch({ "https://cafe.example/menu": { body: menuHtml } }), render);
    expect(await (await f("https://cafe.example/menu")).text()).toBe(menuHtml);
    expect(render.calls).toEqual([]);
  });

  it("[ai] AC1 integration: PDFs and images pass through untouched", async () => {
    const render = fakeRender(menuHtml);
    const f = renderingFetch(fakeFetch({ "https://cafe.example/menu.pdf": { body: "%PDF-1.7", type: "application/pdf" } }), render);
    const res = await f("https://cafe.example/menu.pdf");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(render.calls).toEqual([]);
  });

  it("[ai] AC1 integration: a blocked download (HTTP 403) is retried in the browser", async () => {
    const render = fakeRender(menuHtml);
    const f = renderingFetch(fakeFetch({ "https://cafe.example/menu": { status: 403, body: "Forbidden" } }), render);
    const res = await f("https://cafe.example/menu");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(menuHtml);
  });

  it("[ai] AC1 integration: if rendering fails or finds no more menu, the original response is kept", async () => {
    const failing = renderingFetch(fakeFetch({ "https://cafe.example/menu": { status: 403, body: "Forbidden" } }), fakeRender(new Error("timeout")));
    expect((await failing("https://cafe.example/menu")).status).toBe(403);
    const stillEmpty = renderingFetch(fakeFetch({ "https://cafe.example/menu": { body: emptyShell } }), fakeRender(emptyShell));
    expect(await (await stillEmpty("https://cafe.example/menu")).text()).toBe(emptyShell);
  });
});
