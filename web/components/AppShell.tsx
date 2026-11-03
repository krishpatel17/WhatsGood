"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, profileStore, type Profile } from "../lib/api";
import { Dialog } from "./Dialog";
import { ProfileForm } from "./ProfileForm";
import { ScanForm } from "./ScanForm";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [modal, setModal] = useState<"profile" | "scan" | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restaurant, setRestaurant] = useState("");
  useEffect(() => {
    let live = true;
    const refresh = () => {
      const id = profileStore.get();
      if (id)
        api
          .getProfile(id)
          .then((p) => {
            if (live) setProfile(p);
          })
          .catch(() => {});
    };
    refresh();
    window.addEventListener("wg:profile", refresh);
    const id = new URLSearchParams(location.search).get("r");
    if (id)
      api
        .restaurant(id)
        .then((r) => {
          if (live) setRestaurant(r.name);
        })
        .catch(() => {});
    return () => {
      live = false;
      window.removeEventListener("wg:profile", refresh);
    };
  }, [path]);
  const scanActive = modal === "scan" || path.startsWith("/scan");
  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <a href="/" className="brand" aria-label="What's Good home">
            WHAT’S GOOD<span className="brand-dot">.</span>
          </a>
          <nav className="source-switch" aria-label="Menu source">
            <a href="/" aria-current={!scanActive ? "page" : undefined}>
              Pick Restaurant
            </a>
            <button
              type="button"
              aria-pressed={scanActive}
              onClick={() => setModal("scan")}
            >
              Scan Menu
            </button>
          </nav>
          {restaurant && (
            <span className="restaurant-pill" title={restaurant}>
              {restaurant}
            </span>
          )}
          <button
            className="profile-button"
            onClick={() => setModal("profile")}
          >
            My profile
            {profile && (
              <span className="profile-dot" aria-label="Profile set" />
            )}
          </button>
        </div>
      </header>
      <div className="page-clip">
        <main className={path.startsWith("/results") ? "results-page" : undefined}>{children}</main>
      </div>
      {modal && (
        <Dialog
          title={modal === "profile" ? "Your profile" : "Scan the menu"}
          onClose={() => setModal(null)}
        >
          {modal === "profile" ? (
            <ProfileForm onSaved={() => setModal(null)} />
          ) : (
            <ScanForm />
          )}
        </Dialog>
      )}
    </>
  );
}
