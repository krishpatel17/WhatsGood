"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type StoredRecommendation } from "../../lib/api";

function Rate() {
  const recId = useSearchParams().get("rec") ?? "";
  const [rec, setRec] = useState<StoredRecommendation | null>(null);
  const [dish, setDish] = useState<{ id: string | null; name: string } | null>(null);
  const [other, setOther] = useState("");
  const [stars, setStars] = useState(0);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  useEffect(() => {
    if (recId) api.recommendation(recId).then(setRec).catch(() => setState("error"));
  }, [recId]);

  const submit = async () => {
    if (!dish || !stars) return;
    try {
      await api.rate(recId, dish.id ? { dishId: dish.id, rating: stars } : { dishId: null, dishName: other, rating: stars });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") return <h1>Thanks! Your rating helps the next diner.</h1>;
  if (!rec) return <p className="notice">{state === "error" ? "Couldn't load that meal." : "Loading…"}</p>;
  if (rec.rated) return <p className="notice">You already rated this meal.</p>;

  return (
    <>
      <h1>How was it?</h1>
      <p className="sub">Which dish did you order?</p>
      <div className="choices">
        {rec.picks.map((p) => (
          <button key={p.dishId} aria-pressed={dish?.id === p.dishId} onClick={() => setDish({ id: p.dishId, name: p.name })}>
            {p.name}
          </button>
        ))}
        <button aria-pressed={dish !== null && dish.id === null} onClick={() => setDish({ id: null, name: "" })}>
          Something else
        </button>
      </div>
      {dish && dish.id === null && <input type="search" aria-label="What did you order?" placeholder="What did you order?" value={other} onChange={(e) => setOther(e.target.value)} />}
      <div className="stars" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={stars === n} onClick={() => setStars(n)}>
            {"★".repeat(n)}
          </button>
        ))}
      </div>
      <button className="button block" disabled={!dish || !stars || (dish.id === null && !other.trim())} onClick={submit}>
        Submit
      </button>
      {state === "error" && <p className="notice">Couldn't save your rating. Try again.</p>}
    </>
  );
}

export default function RatePage() {
  return (
    <Suspense>
      <Rate />
    </Suspense>
  );
}
