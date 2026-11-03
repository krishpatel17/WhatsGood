export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export type Flag = "ask_server" | "price_unknown";
export type Label = "few_reviews" | "menu_only";

export type Pick = {
  dishId: string;
  name: string;
  price: number | null;
  reason: string | null;
  quotes: string[];
  mentionCount: number;
  flags: Flag[];
  labels: Label[];
};

export type Picks = {
  mode: "llm" | "fallback" | "none";
  picks: Pick[];
  explanation: string | null;
  recommendationId?: string;
};
export type Restaurant = {
  id: string;
  name: string;
  address: string;
  has_menu: boolean;
  has_reviews: boolean;
};
export type Profile = {
  allergies: string[];
  diets: string[];
  budget: number | null;
  tastes: string[];
  notes: string;
};
export type StoredRecommendation = {
  id: string;
  restaurantId: string;
  picks: Pick[];
  rated: boolean;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({ error: res.statusText }))).error ??
        res.statusText,
    );
  return res.json() as Promise<T>;
}

export const api = {
  createRestaurant: (name: string, address: string) =>
    call<{ id: string }>("/restaurants", {
      method: "POST",
      body: JSON.stringify({ name, address }),
    }),
  importMenu: (r: string, url: string) =>
    call<{ status: string; message?: string }>(`/restaurants/${r}/menu`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  search: (q: string) =>
    call<{ results: Restaurant[]; suggest?: string }>(
      `/restaurants?q=${encodeURIComponent(q)}`,
    ),
  restaurant: (id: string) => call<Restaurant>(`/restaurants/${id}`),
  createProfile: (p: Profile) =>
    call<{ id: string }>("/profiles", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  getProfile: (id: string) => call<Profile & { id: string }>(`/profiles/${id}`),
  updateProfile: (id: string, p: Partial<Profile>) =>
    call<Profile>(`/profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p),
    }),
  fallback: (r: string, profileId: string) =>
    call<Picks>(`/restaurants/${r}/fallback?profileId=${profileId}`),
  recommend: (r: string, profileId: string) =>
    call<Picks>(`/restaurants/${r}/recommend`, {
      method: "POST",
      body: JSON.stringify({ profileId }),
    }),
  recommendation: (id: string) =>
    call<StoredRecommendation>(`/recommendations/${id}`),
  rate: (
    id: string,
    body: { dishId: string | null; dishName?: string; rating: number },
  ) =>
    call<{ ratingId: string }>(`/recommendations/${id}/rating`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  dismiss: (id: string) =>
    fetch(`${API_URL}/recommendations/${id}/dismiss`, { method: "POST" }),
  pendingRating: (profileId: string) =>
    call<{ recommendation: StoredRecommendation | null }>(
      `/profiles/${profileId}/pending-rating`,
    ),
  scan: (r: string, photo: Blob) => {
    const form = new FormData();
    form.append("photo", photo, "menu.jpg");
    return fetch(`${API_URL}/restaurants/${r}/scan`, {
      method: "POST",
      body: form,
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok && body.status !== "retake")
        throw new Error(body.error ?? "Could not read the menu. Try again.");
      return body as { status: string; message?: string };
    });
  },
};

const KEY = "wg.profileId";

/** The diner's profile id lives in this browser only; reads and writes never throw. */
export const profileStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(id: string) {
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  },
};
