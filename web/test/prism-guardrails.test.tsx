// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PickCard } from "../components/PickCard";
import { ResultsView } from "../components/ResultsView";
import { api, type Pick } from "../lib/api";
const pick: Pick = {
  dishId: "d",
  name: "Noodles",
  price: 16.5,
  reason: "A generated reason",
  quotes: ["Noodles are excellent."],
  mentionCount: 0,
  flags: [],
  labels: [],
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("[ai] final fallback omits generated text even if present in a malformed response", () => {
  render(<PickCard pick={pick} rank={1} isFallback />);
  expect(screen.queryByText(pick.reason!)).toBeNull();
  expect(screen.queryByRole("blockquote")).toBeNull();
  expect(screen.getByText(/Verified on menu/)).toBeTruthy();
  expect(screen.getByText(/Mentioned in 0 reviews/)).toBeTruthy();
});
it("[ai] final fallback clears the generation loading state", async () => {
  vi.spyOn(api, "fallback").mockResolvedValue({
    mode: "fallback",
    picks: [pick],
    explanation: null,
  });
  vi.spyOn(api, "recommend").mockResolvedValue({
    mode: "fallback",
    picks: [pick],
    explanation: null,
  });
  render(<ResultsView restaurantId="r" profileId="p" />);
  await waitFor(() =>
    expect(screen.getByText("Verified Menu Ranking")).toBeTruthy(),
  );
  expect(screen.queryByText(/Finding the best picks/)).toBeNull();
  expect(screen.queryByRole("blockquote")).toBeNull();
});
