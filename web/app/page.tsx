"use client";
import { useEffect, useState } from "react";
import {
  api,
  profileStore,
  type Restaurant,
  type StoredRecommendation,
} from "../lib/api";
export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<StoredRecommendation | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => {
      const id = profileStore.get();
      setProfileId(id);
      if (id)
        api
          .pendingRating(id)
          .then((r) => setPending(r.recommendation))
          .catch(() => {});
    };
    refresh();
    window.addEventListener("wg:profile", refresh);
    return () => window.removeEventListener("wg:profile", refresh);
  }, []);
  useEffect(() => {
    let live = true;
    setResults(null);
    setError(false);
    const t = setTimeout(
      () =>
        api
          .search(q.trim())
          .then((r) => {
            if (live) setResults(r.results);
          })
          .catch(() => {
            if (live) setError(true);
          }),
      q ? 200 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, retry]);
  return (
    <>
      {pending && (
        <div className="banner" role="status">
          <span>How was your last meal?</span>
          <span>
            <a className="button" href={`/rate/?rec=${pending.id}`}>
              Rate it
            </a>{" "}
            <button
              className="button secondary"
              onClick={() =>
                api.dismiss(pending.id).then((r) => {
                  if (r.ok) setPending(null);
                })
              }
            >
              Not now
            </button>
          </span>
        </div>
      )}
      <section className="hero">
        <div className="hero-search">
          <h1>What should I order?</h1>
          <p className="sub">A menu full of choices. Three picks that fit you.</p>
          <div className="search-field">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              type="search"
              aria-label="Restaurant name"
              placeholder="Find the restaurant you’re sitting in"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <aside className="scan-entry">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8M8 12h8M8 16h5" />
          </svg>
          <h2>Menu in hand?</h2>
          <p>Start with a photo, web page or PDF link.</p>
          <a href="/scan/" className="button">
            Scan the menu <span aria-hidden="true">→</span>
          </a>
        </aside>
      </section>
      {!profileId && (
        <p className="profile-prompt">
          <span>
            <a href="/setup/">Set up your profile</a> so picks fit your
            allergies, diet and budget.
          </span>
        </p>
      )}
      <section className="restaurant-section">
        <div className="section-heading">
          <h2>Pick a Restaurant</h2>
          <span className="section-note">
            {q ? "Search results" : "Saved menus"}
          </span>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            <p>
              Couldn’t load restaurants. Check your connection and try again.
            </p>
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : results === null ? (
          <div
            className="restaurant-list"
            aria-busy="true"
            aria-label="Loading restaurants"
          >
            {[1, 2, 3].map((n) => (
              <div className="restaurant-skeleton" key={n} aria-hidden="true">
                <div className="skeleton medium" />
                <div className="skeleton short" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="list restaurant-list">
            {results.map((r) => (
              <li key={r.id}>
                <a
                  className="restaurant-card"
                  href={r.has_menu ? `/results/?r=${r.id}` : `/scan/?r=${r.id}`}
                >
                  <div className="restaurant-identity" aria-hidden="true">
                    {r.name.trim().slice(0, 1)}
                  </div>
                  <div className="restaurant-details">
                    <div className="restaurant-card-title">
                      <h3>{r.name}</h3>
                    </div>
                    <small>{r.address}</small>
                    <div className="restaurant-meta">
                      <span className={r.has_menu ? "evidence" : "status-pill"}>
                        {r.has_menu ? "✦ Menu loaded" : "No menu loaded"}
                      </span>
                      <span>
                        {r.has_reviews ? "Reviews available" : "No reviews yet"}
                      </span>
                    </div>
                  </div>
                  <svg className="restaurant-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                </a>
              </li>
            ))}
            {results.length === 0 && (
              <li className="empty-state">
                <h3>{q ? "Not on the list yet?" : "Start with your menu"}</h3>
                <p className="notice">
                  {q
                    ? "Try another restaurant name, or add the menu in front of you."
                    : "Add a menu photo or link to get started."}
                </p>
                <a className="button" href="/scan/">
                  Scan the menu
                </a>
              </li>
            )}
          </ul>
        )}
      </section>
      <footer className="menu-prompt">
        <div>
          <h3>Your menu. Your preferences.</h3>
          <p className="notice">
            Can’t find your restaurant? Add a photo, web page or PDF link.
          </p>
        </div>
        <a href="/scan/" className="text-link">
          Add a menu
        </a>
      </footer>
    </>
  );
}
