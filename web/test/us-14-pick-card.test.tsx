// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PickCard } from "../components/PickCard";
import type { Pick } from "../lib/api";

const pick: Pick = {
  dishId: "d1",
  name: "Dan Dan Noodles",
  price: 14,
  reason: "The most-praised dish here, and you like spicy food.",
  quotes: ["Best dan dan noodles in town"],
  mentionCount: 41,
  flags: [],
  labels: [],
};

describe("US-14 Results screen: pick card", () => {
  afterEach(cleanup);

  it("[ai] T1 component: card renders every field", () => {
    render(<PickCard pick={pick} rank={1} />);
    expect(screen.getByRole("heading", { name: "Dan Dan Noodles" })).toBeTruthy();
    expect(screen.getByText("$14.00")).toBeTruthy();
    expect(screen.getByText(pick.reason!)).toBeTruthy();
    expect(screen.getByText(/Best dan dan noodles in town/)).toBeTruthy();
    expect(screen.getByText("41 reviewers mention it")).toBeTruthy();
    expect(screen.queryByTestId("flag")).toBeNull();
  });

  it("[ai] T1 component: each flag and label variant renders its own warning", () => {
    render(<PickCard pick={{ ...pick, price: null, mentionCount: 1, flags: ["ask_server", "price_unknown"], labels: ["few_reviews"] }} rank={2} />);
    const flags = screen.getAllByTestId("flag").map((f) => f.textContent);
    expect(flags).toEqual(["Ask your server about ingredients", "Price not listed. Check before ordering", "Based on few reviews"]);
    expect(screen.getByText("1 reviewer mentions it")).toBeTruthy();
    expect(screen.getByText("Price not listed")).toBeTruthy();
  });

  it("[ai] T1 component: menu-only and fallback picks show no invented text", () => {
    render(<PickCard pick={{ ...pick, reason: null, quotes: [], mentionCount: 0, labels: ["menu_only"] }} rank={1} />);
    expect(screen.getAllByTestId("flag").map((f) => f.textContent)).toEqual(["Based on the menu only"]);
    expect(screen.queryByRole("blockquote")).toBeNull();
    expect(screen.queryByText(/reviewer/)).toBeNull();
  });

  it("[manual] T1 component: the card never says a dish is safe", () => {
    const { container } = render(<PickCard pick={{ ...pick, flags: ["ask_server"] }} rank={1} />);
    expect(container.textContent).not.toMatch(/\bsafe\b|allergen-free/i);
  });
});
