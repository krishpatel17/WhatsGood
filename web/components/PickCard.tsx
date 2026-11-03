import type { Pick, Profile } from "../lib/api";
import { dishArt, FoodArt, tileClass } from "./FoodArt";
const FLAG_TEXT: Record<string, string> = {
  ask_server: "Ask your server about ingredients",
  price_unknown: "Price not listed. Check before ordering",
  few_reviews: "Based on few reviews",
  menu_only: "Based on the menu only",
};
export function PickCard({
  pick,
  rank,
  isFallback = false,
  profile,
}: {
  pick: Pick;
  rank: number;
  isFallback?: boolean;
  profile?: Profile | null;
}) {
  const notes = [...new Set([...pick.flags, ...pick.labels])];
  const showEvidence =
    !isFallback && Boolean(pick.reason) && Boolean(pick.quotes[0]);
  // The response does not attest ingredient/diet attributes. Only price fit is independently observable here.
  const budgetFit =
    profile?.budget != null &&
    pick.price !== null &&
    pick.price <= profile.budget;
  return (
    <article className={`card pick-card${rank === 1 ? " top-pick" : ""}`} data-testid="pick-card">
      <div className={`pick-art ${tileClass(pick.name)}`}>
        <FoodArt kind={dishArt(pick.name)} />
      </div>
      <div className="pick-body">
      <div className="card-head">
        <div className="card-badges">
          <span className="rank">#{rank} Pick</span>
          <span className="evidence count">
            ✦ Mentioned in {pick.mentionCount}{" "}
            {pick.mentionCount === 1 ? "review" : "reviews"}
          </span>
        </div>
        <span className="price">
          {pick.price === null
            ? "Price not listed"
            : `$${pick.price.toFixed(2)}`}
        </span>
      </div>
      <div>
        <h3>{pick.name}</h3>
        {budgetFit && (
          <p className="fit">
            <strong>Fits profile:</strong> Under ${profile!.budget}
          </p>
        )}
      </div>
      {showEvidence ? (
        <>
          <p className="reason">{pick.reason}</p>
          <blockquote>
            <p>“{pick.quotes[0]}”</p>
            <footer className="evidence">✦ Verified review quote</footer>
          </blockquote>
        </>
      ) : (
        <div className="ranking-footer">
          <span>Ranked by menu match &amp; review sentiment</span>
          <span className="evidence">✦ Verified on menu</span>
        </div>
      )}
      {pick.mentionCount > 0 && (
        <span className="sr-only">
          {pick.mentionCount === 1
            ? "1 reviewer mentions it"
            : `${pick.mentionCount} reviewers mention it`}
        </span>
      )}
      {notes.length > 0 && (
        <ul className="flags">
          {notes.map((f) => (
            <li
              key={f}
              data-testid="flag"
              className={f === "ask_server" ? "flag warn" : "flag"}
            >
              {FLAG_TEXT[f]}
            </li>
          ))}
        </ul>
      )}
      </div>
    </article>
  );
}
