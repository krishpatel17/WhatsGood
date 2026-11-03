"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResultsView } from "../../components/ResultsView";
import {
  api,
  profileStore,
  type Profile,
  type Restaurant,
} from "../../lib/api";
import { FoodArt, restaurantArt, tileClass } from "../../components/FoodArt";
import { label } from "../../components/ProfileForm";
function Results() {
  const restaurantId = useSearchParams().get("r") ?? "";
  const [profileId, setProfileId] = useState<string | null | undefined>(
    undefined,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      const id = profileStore.get();
      setProfileId(id);
      setProfile(null);
      if (id)
        api
          .getProfile(id)
          .then((p) => {
            if (live) setProfile(p);
          })
          .catch(() => {});
      setRevision((n) => n + 1);
    };
    refresh();
    window.addEventListener("wg:profile", refresh);
    if (restaurantId)
      api
        .restaurant(restaurantId)
        .then((r) => {
          if (live) setRestaurant(r);
        })
        .catch(() => {});
    return () => {
      live = false;
      window.removeEventListener("wg:profile", refresh);
    };
  }, [restaurantId]);
  if (profileId === undefined)
    return (
      <p className="notice" role="status">
        Loading your profile…
      </p>
    );
  if (!profileId)
    return (
      <div className="empty-state">
        <h1>Make these picks yours</h1>
        <p className="explain">
          <a href="/setup/">Set up your profile</a> first. It takes under a
          minute.
        </p>
      </div>
    );
  if (!restaurantId)
    return (
      <div className="empty-state">
        <h1>Start with a restaurant</h1>
        <a href="/" className="button">
          Pick Restaurant
        </a>
      </div>
    );
  const summary = profile
    ? [
        ...profile.allergies.map((a) => `${label(a)} allergy`),
        ...profile.diets.map(label),
        ...(profile.budget != null ? [`under $${profile.budget}`] : []),
        ...profile.tastes.map(label),
      ].join(" · ")
    : "";
  const name = restaurant?.name ?? "";
  return (
    <>
      <div className={`results-hero ${restaurant ? tileClass(name) : "tile tile-3"}`}>
        {restaurant && (
          <div className="results-art">
            <FoodArt kind={restaurantArt(name)} initial={name.trim().slice(0, 1)} />
          </div>
        )}
        <div className="results-copy">
        <a className="back-link" href="/">
          ← Restaurants
        </a>
        <h1>{restaurant?.name ?? "Your picks"}</h1>
        <p className="sub">
          Up to three dishes, checked against the menu and real reviews.
        </p>
        {restaurant?.address && <p className="address">{restaurant.address}</p>}
        </div>
      </div>
      {summary && (
        <p className="profile-summary" data-testid="profile-summary">
          <strong>Your profile:</strong> {summary}
        </p>
      )}
      <ResultsView
        key={`${restaurantId}-${revision}`}
        restaurantId={restaurantId}
        profileId={profileId}
        profile={profile}
      />
    </>
  );
}
export default function ResultsPage() {
  return (
    <Suspense>
      <Results />
    </Suspense>
  );
}
