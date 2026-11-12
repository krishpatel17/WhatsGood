"use client";
import { useEffect, useState } from "react";

const STEPS = [
  "Reading the menu",
  "Checking what reviewers say",
  "Matching dishes to your profile",
  "Double-checking allergens and diet",
  "Choosing your top 3",
];

/** Shown while the AI is still choosing picks: a spinner, a rotating step, elapsed time and a moving bar. */
export function PicksProgress({ meanwhile }: { meanwhile?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const step = STEPS[Math.min(Math.floor(secs / 4), STEPS.length - 1)];
  return (
    <div className="ai-progress" aria-busy="true" data-testid="ai-progress">
      <div className="ai-progress-row">
        <span className="spinner" aria-hidden="true" />
        <div className="ai-progress-copy">
          <p className="ai-progress-title" role="status">
            Finding the best picks for you…
          </p>
          <p className="ai-progress-step" aria-hidden="true">
            {step}
            {secs >= 3 && <span className="ai-progress-time"> · {secs}s</span>}
          </p>
          {secs >= 20 && (
            <p className="ai-progress-step">Still working. Bigger menus can take up to a minute.</p>
          )}
        </div>
      </div>
      <div className="ai-progress-bar" aria-hidden="true">
        <span />
      </div>
      {meanwhile && <p className="ai-progress-meanwhile">{meanwhile}</p>}
    </div>
  );
}
