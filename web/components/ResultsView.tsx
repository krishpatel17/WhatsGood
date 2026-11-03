"use client";
import { useEffect, useState } from "react";
import { api, type Picks, type Profile } from "../lib/api";
import { PickCard } from "./PickCard";
export function ResultsView({
  restaurantId,
  profileId,
  profile,
}: {
  restaurantId: string;
  profileId: string;
  profile?: Profile | null;
}) {
  const [picks, setPicks] = useState<Picks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let finished = false;
    setPicks(null);
    setError(null);
    setGenerating(true);
    api
      .fallback(restaurantId, profileId)
      .then((fb) => {
        if (live) setPicks((cur) => cur ?? fb);
      })
      .catch(() => {})
      .finally(() => {
        if (live && finished) setGenerating(false);
      });
    api
      .recommend(restaurantId, profileId)
      .then((rec) => {
        if (live) setPicks(rec);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        finished = true;
        if (live) setGenerating(false);
      });
    return () => {
      live = false;
    };
  }, [restaurantId, profileId, retry]);
  if (error && !picks)
    return (
      <div className="empty-state" role="alert">
        <h2>Couldn’t get your picks</h2>
        <p className="notice">Couldn't get picks: {error}</p>
        <button className="button" onClick={() => setRetry((n) => n + 1)}>
          Try again
        </button>
        <a className="button secondary" href="/scan/">
          Scan Menu
        </a>
      </div>
    );
  if (!picks)
    return (
      <section aria-busy="true" aria-label="Loading recommendations">
        <p className="notice" role="status">
          Finding the best picks for you…
        </p>
        {[1, 2, 3].map((n) => (
          <div className="card skeleton-card" key={n} aria-hidden="true">
            <div className="skeleton short" />
            <div className="skeleton medium" />
            <div className="skeleton" />
            <div className="skeleton quote-skeleton" />
          </div>
        ))}
      </section>
    );
  return (
    <section data-testid="results" data-mode={picks.mode}>
      <div className="section-heading">
        <h2>
          {picks.mode === "fallback"
            ? "Verified Menu Ranking"
            : "Top 3 Picks for You"}
        </h2>
        <span className="section-note">
          {picks.picks.length} {picks.picks.length === 1 ? "dish" : "dishes"}
        </span>
      </div>
      {picks.mode === "fallback" && generating && (
        <p className="notice" aria-busy="true" role="status">
          Finding the best picks for you… Here are the top-rated dishes
          meanwhile.
        </p>
      )}
      {picks.mode === "fallback" && !generating && (
        <p className="notice">Your menu matches, ranked by review sentiment.</p>
      )}
      {picks.explanation && <p className="explain">{picks.explanation}</p>}
      {picks.picks.length === 0 && (
        <div className="empty-state">
          <p className="notice">No picks to show.</p>
          <p>Try another restaurant or adjust your profile preferences.</p>
          <a className="button secondary" href="/setup/">
            Edit profile
          </a>
        </div>
      )}
      {picks.picks.slice(0, 3).map((p, i) => (
        <PickCard
          key={p.dishId}
          pick={p}
          rank={i + 1}
          isFallback={picks.mode !== "llm"}
          profile={profile}
        />
      ))}
      {picks.recommendationId && picks.picks.length > 0 && (
        <a
          className="button secondary"
          href={`/rate/?rec=${picks.recommendationId}`}
        >
          Rate this meal later
        </a>
      )}
    </section>
  );
}
