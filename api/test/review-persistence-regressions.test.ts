// Manually reviewed and substantially refined by the user, per supplied review.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { testDb } from './helpers/db';
import { seedRestaurant, seedReviews } from './helpers/seed';
import { mockLlm } from './helpers/llm';
import { storeMenu } from '../src/menu/import';
import { extractMentions } from '../src/reviews/mentions';
import { checkEvidence, loadEvidence } from '../src/guardrails/evidence';
import { dishStats } from '../src/reviews/stats';
import { coverageRow } from '../src/validation/coverage';
import { easyMenu } from './fixtures/menus';
let db: ReturnType<typeof testDb>;
let seed: Awaited<ReturnType<typeof seedRestaurant>>;
beforeEach(async()=>{db=testDb();seed=await seedRestaurant(db);});
afterEach(()=>db.raw.close());
const replacement = () => ({restaurantId:'r1',sourceUrl:'https://menu.example/new',sourceType:'html',snapshotKey:'new',status:'active' as const,attempts:1,dishes:easyMenu.dishes});
function seedOldEvidence() {
  db.raw.prepare("INSERT INTO mentions (id,restaurant_id,review_id,dish_id,mention,sentiment,quote,score) VALUES ('old','r1',?,?,'Dan Dan Noodles',0.8,'Best dan dan noodles in town',1)").run(seed.reviewId('google:3'),seed.dishId('Dan Dan Noodles'));
  return db.raw.prepare('SELECT * FROM mentions').all();
}
it('[manual] PERSIST-R01 dish insert failure preserves the entire previous active menu', async()=>{
  db.raw.exec("CREATE TRIGGER fail_dish BEFORE INSERT ON dishes WHEN NEW.name = 'Pork Dumplings' BEGIN SELECT RAISE(ABORT, 'injected dish failure'); END");
  const before = db.raw.prepare("SELECT d.name FROM dishes d JOIN menus m ON m.id=d.menu_id WHERE m.status='active' ORDER BY d.name").all();
  await expect(storeMenu(db,replacement())).rejects.toThrow('injected dish failure');
  expect(db.raw.prepare("SELECT id FROM menus WHERE status='active'").all()).toEqual([{id:seed.menuId}]);
  expect(db.raw.prepare("SELECT d.name FROM dishes d JOIN menus m ON m.id=d.menu_id WHERE m.status='active' ORDER BY d.name").all()).toEqual(before);
});
it('[manual] PERSIST-R02 concurrent replacements leave exactly one complete active menu',async()=>{
  const ids=await Promise.all([storeMenu(db,replacement()),storeMenu(db,replacement())]);
  const active=db.raw.prepare("SELECT id FROM menus WHERE status='active'").all() as {id:string}[];
  expect(active).toHaveLength(1);expect(ids).toContain(active[0].id);
  expect(db.raw.prepare('SELECT COUNT(*) AS n FROM dishes WHERE menu_id=?').get(active[0].id)).toEqual({n:easyMenu.dishes.length});
});
it('[manual] PERSIST-R03 failed model refresh preserves the previous evidence snapshot',async()=>{
  const old=seedOldEvidence();
  await expect(extractMentions({db,llm:{json:async()=>{throw new Error('model unavailable');}}},'r1')).rejects.toThrow('model unavailable');
  expect(db.raw.prepare('SELECT * FROM mentions').all()).toEqual(old);
});
it('[manual] PERSIST-R04 database failure during refresh preserves previous evidence',async()=>{
  const old=seedOldEvidence();
  db.raw.exec("CREATE TRIGGER fail_mention BEFORE INSERT ON mentions BEGIN SELECT RAISE(ABORT, 'injected mention failure'); END");
  const llm=mockLlm([{mentions:[{review_id:seed.reviewId('google:4'),dish:'Dan Dan Noodles',sentiment:1,quote:'Loved the dan dan noodles'}]}]);
  await expect(extractMentions({db,llm},'r1')).rejects.toThrow('injected mention failure');
  expect(db.raw.prepare('SELECT * FROM mentions').all()).toEqual(old);
});
it('[manual] PERSIST-R05 failure in the second extraction batch cannot publish partial evidence',async()=>{
  // Seed enough reviews to cross the actual batch boundary; no mocked transaction behavior.
  db.raw.close();db=testDb();
  seed=await seedRestaurant(db,'r1',[...seedReviews,...Array.from({length:25},(_,i)=>({source_id:`extra:${i}`,source:'google' as const,rating:4,date:'2026-11-01',text:`Review ${i}: Good noodles.`}))]);
  const old=seedOldEvidence();
  const llm=mockLlm([{mentions:[{review_id:seed.reviewId('google:4'),dish:'Dan Dan Noodles',sentiment:1,quote:'Loved the dan dan noodles'}]},()=>{throw new Error('second batch failed');}]);
  await expect(extractMentions({db,llm},'r1')).rejects.toThrow('second batch failed');expect(llm.calls).toHaveLength(2);
  expect(db.raw.prepare('SELECT * FROM mentions').all()).toEqual(old);
});
it('[manual] EVIDENCE-R01 repeated mentions from one review cannot inflate review counts or A3 thresholds',async()=>{
  const review_id=seed.reviewId('google:3');const dishId=seed.dishId('Dan Dan Noodles');
  const mention={review_id,dish:'Dan Dan Noodles',sentiment:1,quote:'Best dan dan noodles in town'};
  await extractMentions({db,llm:mockLlm([{mentions:[mention,mention,mention]}])},'r1');
  const ev=await loadEvidence(db,'r1');const stats=await dishStats(db,'r1');
  expect(ev.byDish.get(dishId)?.count).toBe(1);expect(stats.get(dishId)?.mentions).toBe(1);
  expect(coverageRow('r1','R',1,new Map([[dishId,stats.get(dishId)!.mentions]]))).toMatchObject({atLeast1:1,atLeast3:0,enough:false});
});
it('[manual] EVIDENCE-R02 a positive quote about A cannot be attributed to B in the same mixed review',()=>{
  const review='Dan Dan Noodles were excellent. Pork Dumplings were soggy.';
  const ev={reviews:new Map([['mixed',review]]),byDish:new Map([['b',{count:1,avgSentiment:-1,reviewIds:new Set(['mixed'])}]])};
  const dish={id:'b',name:'Pork Dumplings',section:'Mains',price:9,description:null,tags:[]};
  const errors=checkEvidence([{dish:'Pork Dumplings',reason:'Popular',quotes:['Dan Dan Noodles were excellent.'],mention_count:1}],[dish],ev);
  expect(errors.length).toBeGreaterThan(0);
});

it('[manual] PERSIST-R06 malformed extraction output preserves the previous snapshot', async () => {
  const old = seedOldEvidence();
  await expect(extractMentions({ db, llm: mockLlm([{ mentions: 'not an array' }]) }, 'r1')).rejects.toThrow('invalid mention extraction');
  expect(db.raw.prepare('SELECT * FROM mentions').all()).toEqual(old);
});
it('[manual] EVIDENCE-R03 stored dish-specific spans prevent cross-attribution within one review', async () => {
  const reviewId = seed.reviewId('google:1');
  const noodleId = seed.dishId('Dan Dan Noodles');
  const dumplingId = seed.dishId('Pork Dumplings');
  const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, 'r1', ?, ?, ?, ?, ?, 1)");
  insert.run('positive', reviewId, noodleId, 'Dan Dan Noodles', 0.8, 'The dan dan noodles are great');
  insert.run('negative', reviewId, dumplingId, 'Pork Dumplings', -0.8, 'skip the pork dumplings, they were soggy');
  const evidence = await loadEvidence(db, 'r1');
  const dish = { id: dumplingId, name: 'Pork Dumplings', section: 'Dumplings', price: 9, description: null, tags: [] };
  const pick = { dish: dish.name, reason: 'Popular', quotes: ['The dan dan noodles are great'], mention_count: 1 };
  expect(checkEvidence([pick], [dish], evidence)).toEqual(['item[0].quotes[0] quote is not attributed to "Pork Dumplings"']);
  expect(checkEvidence([{ ...pick, quotes: ['skip the pork dumplings'] }], [dish], evidence)).toEqual([]);
});
it('[manual] EVIDENCE-R04 each review has equal sentiment weight despite multiple mention spans', async () => {
  const dishId = seed.dishId('Dan Dan Noodles');
  const insert = db.raw.prepare("INSERT INTO mentions (id, restaurant_id, review_id, dish_id, mention, sentiment, quote, score) VALUES (?, 'r1', ?, ?, 'Dan Dan Noodles', ?, 'q', 1)");
  insert.run('a', seed.reviewId('google:1'), dishId, 1);
  insert.run('b', seed.reviewId('google:1'), dishId, 1);
  insert.run('c', seed.reviewId('google:3'), dishId, -1);
  expect((await dishStats(db, 'r1')).get(dishId)).toEqual({ mentions: 2, avgSentiment: 0 });
  expect((await loadEvidence(db, 'r1')).byDish.get(dishId)).toMatchObject({ count: 2, avgSentiment: 0 });
});
