"use client";
import { useEffect, useState } from "react";
import { api, profileStore, type Restaurant, type StoredRecommendation } from "../lib/api";

export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [pending, setPending] = useState<StoredRecommendation | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    const id = profileStore.get();
    setProfileId(id);
    if (id) api.pendingRating(id).then((r) => setPending(r.recommendation)).catch(() => {});
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setResults(null);
    const t = setTimeout(() => api.search(q).then((r) => setResults(r.results)).catch(() => setResults([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      {pending && (
        <div className="banner" role="status">
          <span>How was your last meal?</span>
          <span>
            <a className="button" href={`/rate/?rec=${pending.id}`}>
              Rate it
            </a>{" "}
            <button className="button secondary" onClick={() => api.dismiss(pending.id).then(() => setPending(null))}>
              Not now
            </button>
          </span>
        </div>
      )}
      <h1>What should I order?</h1>
      <p className="sub">Find the restaurant you’re sitting in.</p>
      {!profileId && (
        <p className="explain">
          <a href="/setup/">Set up your profile</a> first so picks fit your allergies, diet and budget.
        </p>
      )}
      <input type="search" aria-label="Restaurant name" placeholder="e.g. Bodo's" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {results && (
        <ul className="list">
          {results.map((r) => (
            <li key={r.id}>
              <a href={`/results/?r=${r.id}`}>
                {r.name}
                <small>
                  {r.address} · {r.has_menu ? "menu loaded" : "no menu yet"} · {r.has_reviews ? "reviews loaded" : "no reviews yet"}
                </small>
              </a>
            </li>
          ))}
          {results.length === 0 && (
            <li>
              <a href="/scan/">
                Scan the menu
                <small>Not listed yet? Take a photo of the menu and we’ll read it.</small>
              </a>
            </li>
          )}
        </ul>
      )}
    </>
  );
}
