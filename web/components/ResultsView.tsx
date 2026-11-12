"use client";
import { useEffect, useState } from "react";
import { api, type Picks, type Profile } from "../lib/api";
import { PickCard } from "./PickCard";
import { PicksProgress } from "./PicksProgress";
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
      <section aria-label="Loading recommendations">
        <PicksProgress />
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
  const reviewBacked = picks.picks.some((p) => p.mentionCount > 0);
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
        <PicksProgress
          meanwhile={
            reviewBacked
              ? "Here are the top-rated dishes meanwhile. They'll update when your picks are ready."
              : "Here are some menu matches meanwhile. They'll update when your picks are ready."
          }
        />
      )}
      {picks.mode === "fallback" && !generating && (
        <p className="notice">
          {reviewBacked
            ? "Your menu matches, ranked by review sentiment."
            : "Your menu matches, listed alphabetically."}
        </p>
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
      {picks.picks.length > 0 && (
        <p className="art-note">Illustrations set the mood. They aren’t photos of the dish.</p>
      )}
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
