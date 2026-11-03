"use client";
import { useEffect, useState } from "react";
import { api, profileStore, type Profile } from "../../lib/api";

const ALLERGIES = ["peanut", "tree_nut", "shellfish", "fish", "egg", "dairy", "gluten", "soy", "sesame"];
const DIETS = ["vegetarian", "vegan", "pescatarian", "no_pork", "no_beef", "halal", "kosher", "gluten_free", "dairy_free"];
const TASTES = ["spicy", "mild", "sweet", "savory", "light", "hearty", "adventurous", "comfort"];
const label = (s: string) => s.replace(/_/g, " ");

function Chips({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((o) => (
          <label key={o} className="chip">
            <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Setup() {
  const [p, setP] = useState<Profile>({ allergies: [], diets: [], budget: null, tastes: [], notes: "" });
  const [id, setId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = profileStore.get();
    if (existing) {
      setId(existing);
      api.getProfile(existing).then(({ id: _id, ...rest }) => setP(rest)).catch(() => {});
    }
  }, []);

  const save = async () => {
    if (id) await api.updateProfile(id, p);
    else {
      const created = await api.createProfile(p);
      profileStore.set(created.id);
      setId(created.id);
    }
    setSaved(true);
  };

  return (
    <>
      <h1>Your profile</h1>
      <p className="sub">Set it once. Every pick will fit it. Leave anything blank.</p>
      <Chips legend="Allergies" options={ALLERGIES} value={p.allergies} onChange={(allergies) => setP({ ...p, allergies })} />
      <Chips legend="Diet" options={DIETS} value={p.diets} onChange={(diets) => setP({ ...p, diets })} />
      <fieldset>
        <legend>Budget per dish (optional)</legend>
        <input type="number" min={0} inputMode="decimal" aria-label="Budget per dish in dollars" placeholder="e.g. 18" value={p.budget ?? ""} onChange={(e) => setP({ ...p, budget: e.target.value === "" ? null : Number(e.target.value) })} />
      </fieldset>
      <Chips legend="I like" options={TASTES} value={p.tastes} onChange={(tastes) => setP({ ...p, tastes })} />
      <fieldset>
        <legend>Anything else? (optional)</legend>
        <textarea rows={2} maxLength={280} aria-label="Other preferences" placeholder="e.g. I love noodles, not a fan of cilantro" value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
      </fieldset>
      <button className="button block" onClick={save}>
        {id ? "Save changes" : "Save profile"}
      </button>
      {saved && (
        <p className="notice" role="status">
          Saved. <a href="/">Find your restaurant →</a>
        </p>
      )}
    </>
  );
}
