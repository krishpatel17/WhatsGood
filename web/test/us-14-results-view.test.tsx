// @vitest-environment jsdom
// Added after the implementation to cover the view and API client in unit tests (the e2e suite covers the same flow in a browser).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ResultsView } from "../components/ResultsView";
import { api, profileStore } from "../lib/api";

const pick = (name: string, reason: string | null) => ({ dishId: name, name, price: 10, reason, quotes: reason ? ["Great"] : [], mentionCount: 3, flags: [], labels: [] });

function mockFetch(routes: Record<string, () => Promise<unknown>>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    const handler = routes[path];
    if (!handler) return new Response(JSON.stringify({ error: "nope" }), { status: 404 });
    return new Response(JSON.stringify(await handler()), { status: 200 });
  });
}

describe("US-14 Results screen: results view", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("[ai] AC2 unit: shows the fallback list first, then replaces it with the AI picks", async () => {
    let release!: () => void;
    const llmReady = new Promise<void>((r) => (release = r));
    mockFetch({
      "/restaurants/r1/fallback": async () => ({ mode: "fallback", picks: [pick("Plain A", null)], explanation: null }),
      "/restaurants/r1/recommend": async () => {
        await llmReady;
        return { mode: "llm", recommendationId: "rec1", picks: [pick("Smart A", "Because you like it")], explanation: null };
      },
    });
    render(<ResultsView restaurantId="r1" profileId="p1" />);
    await waitFor(() => expect(screen.getByTestId("results").dataset.mode).toBe("fallback"));
    expect(screen.getByText("Plain A")).toBeTruthy();
    release();
    await waitFor(() => expect(screen.getByTestId("results").dataset.mode).toBe("llm"));
    expect(screen.getByText("Because you like it")).toBeTruthy();
    expect(screen.queryByText("Plain A")).toBeNull();
    expect(screen.getByRole("link", { name: "Rate this meal later" }).getAttribute("href")).toBe("/rate/?rec=rec1");
  });

  it("[ai] unit: shows the explanation and an error when the API fails", async () => {
    mockFetch({ "/restaurants/r1/fallback": async () => ({ mode: "fallback", picks: [], explanation: "No dishes on this menu fit your profile." }) });
    render(<ResultsView restaurantId="r1" profileId="p1" />);
    await waitFor(() => expect(screen.getByText("No dishes on this menu fit your profile.")).toBeTruthy());
    expect(screen.getByText("No picks to show.")).toBeTruthy();
  });

  it("[ai] unit: API client sends JSON and surfaces server errors", async () => {
    const spy = mockFetch({ "/profiles": async () => ({ id: "p9" }) });
    expect(await api.createProfile({ allergies: [], diets: [], budget: null, tastes: [], notes: "" })).toEqual({ id: "p9" });
    expect(spy.mock.calls[0][1]?.method).toBe("POST");
    await expect(api.restaurant("missing")).rejects.toThrow("nope");
  });

  it("[ai] unit: the profile store survives blocked storage", () => {
    profileStore.set("p1");
    expect(profileStore.get()).toBe("p1");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(profileStore.get()).toBeNull();
  });
});
