"use client";
import { useEffect, useState } from "react";
import { api, type Picks } from "../lib/api";
import { PickCard } from "./PickCard";

/** Shows the instant fallback ranking first, then swaps in the validated AI picks when they arrive. */
export function ResultsView({ restaurantId, profileId }: { restaurantId: string; profileId: string }) {
  const [picks, setPicks] = useState<Picks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    api
      .fallback(restaurantId, profileId)
      .then((fb) => !done && setPicks((cur) => cur ?? fb))
      .catch(() => {});
    api
      .recommend(restaurantId, profileId)
      .then((rec) => {
        done = true;
        setPicks(rec);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      done = true;
    };
  }, [restaurantId, profileId]);

  if (error && !picks) return <p className="notice">Couldn't get picks: {error}</p>;
  if (!picks) return <p className="notice" aria-busy="true">Finding the best picks for you…</p>;

  return (
    <section data-testid="results" data-mode={picks.mode}>
      {picks.mode === "fallback" && !error && (
        <p className="notice" aria-busy="true">
          Finding the best picks for you… Here are the top-rated dishes meanwhile.
        </p>
      )}
      {picks.explanation && <p className="explain">{picks.explanation}</p>}
      {picks.picks.length === 0 && <p className="notice">No picks to show.</p>}
      {picks.picks.map((p, i) => (
        <PickCard key={p.dishId} pick={p} rank={i + 1} />
      ))}
      {picks.recommendationId && picks.picks.length > 0 && (
        <a className="button secondary" href={`/rate/?rec=${picks.recommendationId}`}>
          Rate this meal later
        </a>
      )}
    </section>
  );
}
