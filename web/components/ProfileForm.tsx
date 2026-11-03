"use client";
import { useEffect, useState } from "react";
import { api, profileStore, type Profile } from "../lib/api";
const ALLERGIES = [
  "peanut",
  "tree_nut",
  "shellfish",
  "fish",
  "egg",
  "dairy",
  "gluten",
  "soy",
  "sesame",
];
const DIETS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "no_pork",
  "no_beef",
  "halal",
  "kosher",
  "gluten_free",
  "dairy_free",
];
const TASTES = [
  "spicy",
  "mild",
  "sweet",
  "savory",
  "light",
  "hearty",
  "adventurous",
  "comfort",
];
export const label = (s: string) => s.replace(/_/g, " ");
function Chips({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>
        {legend}{" "}
        <span className="status-pill">
          {value.length ? "✓ Active" : "Optional"}
        </span>
      </legend>
      <div className="chips">
        {options.map((o) => (
          <label key={o} className="chip">
            <input
              type="checkbox"
              checked={value.includes(o)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, o]
                    : value.filter((x) => x !== o),
                )
              }
            />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const [p, setP] = useState<Profile>({
    allergies: [],
    diets: [],
    budget: null,
    tastes: [],
    notes: "",
  });
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let live = true;
    const existing = profileStore.get();
    if (!existing) {
      setState("idle");
      return;
    }
    setId(existing);
    api
      .getProfile(existing)
      .then(({ id: _id, ...rest }) => {
        if (live) {
          setP(rest);
          setState("idle");
        }
      })
      .catch(() => {
        if (live) {
          setLoadError(true);
          setState("error");
        }
      });
    return () => {
      live = false;
    };
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    try {
      if (id) await api.updateProfile(id, p);
      else {
        const created = await api.createProfile(p);
        profileStore.set(created.id);
        setId(created.id);
      }
      setState("saved");
      window.dispatchEvent(new Event("wg:profile"));
      onSaved?.();
    } catch {
      setState("error");
    }
  };
  return (
    <form onSubmit={save}>
      <p className="sub">
        Your preferences, at every restaurant. Leave anything blank.
      </p>
      {loadError ? (
        <p role="alert">
          Couldn’t load your profile.{" "}
          <button
            type="button"
            className="button secondary"
            onClick={() => location.reload()}
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          <fieldset
            disabled={state === "loading" || state === "saving"}
            className="form-fields"
          >
            <Chips
              legend="Allergies"
              options={ALLERGIES}
              value={p.allergies}
              onChange={(allergies) => setP({ ...p, allergies })}
            />
            <p className="field-help">
              Ingredient details can be incomplete. Confirm allergies with your
              server.
            </p>
            <Chips
              legend="Diet"
              options={DIETS}
              value={p.diets}
              onChange={(diets) => setP({ ...p, diets })}
            />
            <fieldset>
              <legend>
                Budget per dish (optional){" "}
                <span className="status-pill">
                  {p.budget !== null ? "✓ Active" : "Optional"}
                </span>
              </legend>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label="Budget per dish in dollars"
                placeholder="e.g. 25"
                value={p.budget ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    budget:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </fieldset>
            <Chips
              legend="I like"
              options={TASTES}
              value={p.tastes}
              onChange={(tastes) => setP({ ...p, tastes })}
            />
            <fieldset>
              <legend>Anything else? (optional)</legend>
              <textarea
                rows={2}
                maxLength={280}
                aria-label="Other preferences"
                placeholder="e.g. I love noodles, not a fan of cilantro"
                value={p.notes}
                onChange={(e) => setP({ ...p, notes: e.target.value })}
              />
            </fieldset>
          </fieldset>
          <div className="form-footer">
            <button
              className="button block"
              disabled={state === "loading" || state === "saving"}
            >
              {state === "saving" ? (
                <>
                  <span className="spinner" /> Saving…
                </>
              ) : onSaved ? (
                `Apply Filters${p.budget !== null ? ` • Under $${p.budget}` : ""}`
              ) : id ? (
                "Save changes"
              ) : (
                "Save profile"
              )}
            </button>
            {state === "error" && (
              <p role="alert">Couldn’t save your profile. Please try again.</p>
            )}
            {state === "saved" && !onSaved && (
              <p className="notice" role="status">
                Saved. <a href="/">Find your restaurant →</a>
              </p>
            )}
          </div>
        </>
      )}
    </form>
  );
}
