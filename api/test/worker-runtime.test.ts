import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';
import type { Env } from '../src/app';
import { storeMenu } from '../src/menu/import';
import { easyMenu } from './fixtures/menus';

// Local workerd, D1 and R2; no account, deployed resources or external model calls.
const server = createTestHarness({root:import.meta.dirname+'/..',workers:[{configPath:'wrangler.toml'}]});
beforeAll(async () => {await server.listen(); await server.getWorker<Env>().applyD1Migrations('DB');},60_000);
afterAll(async () => {await server.close();},30_000);

it('[manual] RUNTIME-R01 Worker routes persist profiles and menu state through real D1 bindings; R2 preserves snapshots', async () => {
  const worker=server.getWorker<Env>();
  const env=await worker.getEnv();
  const post=(path:string,body:unknown)=>worker.fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const profile={allergies:[],diets:[],budget:null,tastes:[],notes:'runtime fixture'};
  const profileRes=await post('/profiles',profile);
  expect(profileRes.status).toBe(201);
  const {id:profileId}=await profileRes.json() as {id:string};
  expect(await (await worker.fetch(`/profiles/${profileId}`)).json()).toMatchObject(profile);
  const restaurantRes=await post('/restaurants',{name:'Runtime Kitchen',address:'1 Test Street'});
  expect(restaurantRes.status).toBe(201);
  const {id}=await restaurantRes.json() as {id:string};
  await env.BUCKET.put('snapshots/runtime','original menu',{httpMetadata:{contentType:'text/html'}});
  const menuId=await storeMenu(env.DB,{restaurantId:id,sourceUrl:null,sourceType:'html',snapshotKey:'snapshots/runtime',status:'active',attempts:1,dishes:easyMenu.dishes});
  const fallback=await worker.fetch(`/restaurants/${id}/fallback?profileId=${profileId}`);
  expect(fallback.status).toBe(200);
  expect((await fallback.json() as {picks:unknown[]}).picks.length).toBeGreaterThan(0);
  expect(await (await env.BUCKET.get('snapshots/runtime'))!.text()).toBe('original menu');
  expect(await env.DB.prepare('SELECT snapshot_key FROM menus WHERE id = ?').bind(menuId).first()).toEqual({snapshot_key:'snapshots/runtime'});
},30_000);

it('[manual] RUNTIME-R02 D1 batch rolls back replacement if a dish insert fails', async () => {
  const env=await server.getWorker<Env>().getEnv();
  const restaurantId=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO restaurants (id,name,address,created_at) VALUES (?,?,?,?)').bind(restaurantId,'Rollback fixture','Test',new Date().toISOString()).run();
  const beforeId=await storeMenu(env.DB,{restaurantId,sourceUrl:null,sourceType:'html',snapshotKey:'old',status:'active',attempts:1,dishes:easyMenu.dishes});
  await env.DB.exec("CREATE TRIGGER runtime_fail BEFORE INSERT ON dishes WHEN NEW.name = 'FAIL' BEGIN SELECT RAISE(ABORT, 'injected disk write failure'); END;");
  await expect(storeMenu(env.DB,{restaurantId,sourceUrl:null,sourceType:'html',snapshotKey:'failed',status:'active',attempts:1,dishes:[{...easyMenu.dishes[0],name:'FAIL'}]})).rejects.toThrow();
  expect(await env.DB.prepare("SELECT id FROM menus WHERE restaurant_id = ? AND status = 'active'").bind(restaurantId).first()).toEqual({id:beforeId});
},30_000);
