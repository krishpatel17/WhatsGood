"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResultsView } from "../../components/ResultsView";
import { api, profileStore, type Restaurant } from "../../lib/api";

function Results() {
  const restaurantId = useSearchParams().get("r") ?? "";
  const [profileId, setProfileId] = useState<string | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    setProfileId(profileStore.get());
    if (restaurantId) api.restaurant(restaurantId).then(setRestaurant).catch(() => {});
  }, [restaurantId]);

  if (profileId === undefined) return null;
  if (!profileId)
    return (
      <p className="explain">
        <a href="/setup/">Set up your profile</a> first. It takes under a minute.
      </p>
    );
  return (
    <>
      <h1>{restaurant?.name ?? "Your picks"}</h1>
      <p className="sub">Up to three dishes, checked against the menu and real reviews.</p>
      <ResultsView restaurantId={restaurantId} profileId={profileId} />
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
