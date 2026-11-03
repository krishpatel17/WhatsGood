import type { Pick } from "../lib/api";

const FLAG_TEXT: Record<string, string> = {
  ask_server: "Ask your server about ingredients",
  price_unknown: "Price not listed. Check before ordering",
  few_reviews: "Based on few reviews",
  menu_only: "Based on the menu only",
};

export function PickCard({ pick, rank }: { pick: Pick; rank: number }) {
  const notes = [...pick.flags, ...pick.labels];
  return (
    <article className="card" data-testid="pick-card">
      <div className="card-head">
        <span className="rank" aria-hidden>
          {rank}
        </span>
        <h2>{pick.name}</h2>
        <span className="price">{pick.price === null ? "Price not listed" : `$${pick.price.toFixed(2)}`}</span>
      </div>
      {pick.reason && <p className="reason">{pick.reason}</p>}
      {pick.quotes[0] && (
        <blockquote>
          “{pick.quotes[0]}” <span className="who">a reviewer</span>
        </blockquote>
      )}
      {pick.mentionCount > 0 && <p className="count">{pick.mentionCount === 1 ? "1 reviewer mentions it" : `${pick.mentionCount} reviewers mention it`}</p>}
      {notes.length > 0 && (
        <ul className="flags">
          {notes.map((f) => (
            <li key={f} data-testid="flag" className={f === "ask_server" ? "flag warn" : "flag"}>
              {FLAG_TEXT[f]}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
