import { type Db, newId, nowIso } from "../db";
import { type Profile, ProfileSchema } from "./schema";

export async function createProfile(db: Db, profile: Profile): Promise<string> {
  const id = newId();
  await db.prepare("INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(profile), nowIso()).run();
  return id;
}

export async function getProfile(db: Db, id: string): Promise<Profile | null> {
  const row = await db.prepare("SELECT data FROM profiles WHERE id = ?").bind(id).first<{ data: string }>();
  return row ? ProfileSchema.parse(JSON.parse(row.data)) : null;
}

export async function updateProfile(db: Db, id: string, patch: Partial<Profile>): Promise<Profile | null> {
  const current = await getProfile(db, id);
  if (!current) return null;
  const next = ProfileSchema.parse({ ...current, ...patch });
  await db.prepare("UPDATE profiles SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(next), nowIso(), id).run();
  return next;
}
