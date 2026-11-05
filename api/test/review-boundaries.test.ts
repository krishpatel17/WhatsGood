import { afterEach, expect, it } from 'vitest';
import { uniqueDishes } from '../src/guardrails/menu';
import { dishConflicts, filterForProfile } from '../src/guardrails/restrictions';
import { ProfileSchema } from '../src/profile/schema';
import { testDb } from './helpers/db';
import { seedRecommendation } from './helpers/recommendation';
import { createApp } from '../src/app';
import { pendingRating } from '../src/feedback/prompt';
import { listEvents } from '../src/events/log';
import type { MenuDish } from '../src/recommend/types';

const dbs: ReturnType<typeof testDb>[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.raw.close(); });
const dish = (id: string, name = 'House Bowl'): MenuDish => ({ id, name, section: 'Mains', price: 10, description: null, tags: [] });

it('[manual] DEDUP-R01 equal counts use stable ID order and preserve the selected listing metadata', () => {
  const a = { ...dish('a'), price: 20, tags: [{ tag: 'peanut' as const, source: 'stated' as const }] };
  const b = { ...dish('b'), price: 8, tags: [{ tag: 'dairy' as const, source: 'stated' as const }] };
  const ev = { reviews: new Map(), byDish: new Map(['a', 'b'].map(id => [id, { count: 2, avgSentiment: 1, reviewIds: new Set([id]) }])) };
  for (const inputs of [[a, b], [b, a]]) {
    const selected = uniqueDishes(inputs, ev);
    expect(selected).toEqual([a]);
    expect(selected[0]).toBe(a);
    expect(filterForProfile(selected, ProfileSchema.parse({ allergies: ['peanut'] })).allowed).toEqual([]);
    expect(filterForProfile(selected, ProfileSchema.parse({ budget: 15 })).allowed).toEqual([]);
    expect(ev.byDish.get(selected[0].id)?.reviewIds).toEqual(new Set(['a']));
  }
  ev.byDish.get('b')!.count = 3;
  expect(uniqueDishes([a, b], ev)).toEqual([b]);
});

it.each(['Peanut, sesame bowl', 'PEANUT / SESAME bowl', 'peanut-\nsesame bowl'])('[manual] INGREDIENT-R01 punctuation and whitespace preserve simultaneous restrictions: %s', name => {
  expect(dishConflicts(dish('x', name), ProfileSchema.parse({ allergies: ['peanut', 'sesame'] }))).toEqual(['allergy: peanut', 'allergy: sesame']);
});
it('[manual] INGREDIENT-R02 plant substitutions suppress implied meat but preserve explicit conflicting ingredients', () => {
  const vegan = ProfileSchema.parse({ diets: ['vegan'] });
  expect(dishConflicts(dish('x', 'Plant-based   burger'), vegan)).toEqual([]);
  expect(dishConflicts({ ...dish('x', 'Plant-based burger'), description: 'Served with dairy cheese' }, vegan)).toEqual(['diet: vegan']);
  // “Nutty” is a conservative exclusion, never evidence that a nut ingredient is certain.
  expect(dishConflicts(dish('x', 'Nutty brown rice'), ProfileSchema.parse({ allergies: ['peanut', 'tree_nut'] }))).toEqual(['allergy: peanut', 'allergy: tree_nut']);
  expect(dishConflicts(dish('x', 'Shamrock eggplant'), ProfileSchema.parse({ allergies: ['egg'], diets: ['no_pork'] }))).toEqual([]);
});

it('[manual] CONCURRENT-R01 concurrent rating requests create one rating and one event of each type', async () => {
  const db = testDb(); dbs.push(db);
  const seed = await seedRecommendation(db);
  const app = createApp({ db });
  const request = () => app.request(`/recommendations/${seed.recommendationId}/rating`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dishId: seed.dishId('Dan Dan Noodles'), rating: 4 }) });
  const results = await Promise.all([request(), request()]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  expect(db.raw.prepare('SELECT COUNT(*) AS n FROM ratings').get()).toEqual({ n: 1 });
  expect(await listEvents(db, 'pick_ordered')).toHaveLength(1);
  expect(await listEvents(db, 'rating_submitted')).toHaveLength(1);
});
it('[manual] CONCURRENT-R02 a pending prompt is claimed by one of two concurrent callers', async () => {
  const db = testDb(); dbs.push(db);
  const seed = await seedRecommendation(db);
  const now = new Date('2026-11-05T12:00:00Z');
  db.raw.prepare('UPDATE recommendations SET created_at = ?').run('2026-11-05T10:00:00Z');
  const results = await Promise.all([pendingRating(db, seed.profileId, now), pendingRating(db, seed.profileId, now)]);
  expect(results.filter(Boolean).map(r => r!.id)).toEqual([seed.recommendationId]);
  expect(await pendingRating(db, seed.profileId, now)).toBeNull();
});
it('[manual] CONCURRENT-R03 an event write failure rolls back the rating and all its events', async () => {
  const db = testDb(); dbs.push(db);
  const seed = await seedRecommendation(db);
  db.raw.exec("CREATE TRIGGER fail_rating_event BEFORE INSERT ON events WHEN NEW.type = 'rating_submitted' BEGIN SELECT RAISE(ABORT, 'injected event failure'); END");
  const { rateMeal } = await import('../src/feedback/rating');
  await expect(rateMeal(db, seed.recommendationId, { dishId: seed.dishId('Dan Dan Noodles'), rating: 4 })).rejects.toThrow('injected event failure');
  expect(db.raw.prepare('SELECT COUNT(*) AS n FROM ratings').get()).toEqual({ n: 0 });
  expect(await listEvents(db, 'pick_ordered')).toHaveLength(0);
  expect(await listEvents(db, 'rating_submitted')).toHaveLength(0);
});
