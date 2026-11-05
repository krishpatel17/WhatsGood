import { afterEach, expect, it, vi } from 'vitest';
import { fetchSource, MAX_SOURCE_BYTES, SOURCE_TIMEOUT_MS } from '../src/menu/fetcher';
import { importMenu, storeMenu } from '../src/menu/import';
import { testDb } from './helpers/db';
import { createRestaurant } from '../src/restaurants/repo';
import { memoryBlobs } from './helpers/blobs';
import { mockLlm } from './helpers/llm';
import { easyMenu } from './fixtures/menus';
import { renderingFetch } from '../src/menu/render';

afterEach(() => vi.useRealTimers());
it.each(['http://127.0.0.1/menu','http://169.254.169.254/latest','https://[::1]/menu','file:///etc/passwd','https://user:pass@menu.example/x','http://localhost/menu','http://192.168.0.1/menu','http://internal.local/menu'])('[manual] FETCH-R01 rejects disallowed destination %s before network I/O', async url => {
  const network = vi.fn();
  await expect(fetchSource(network, url)).rejects.toThrow(/public|https|credentials/i);
  expect(network).not.toHaveBeenCalled();
});
it('[manual] FETCH-R02 follows relative redirects and rejects a redirect to a private destination', async () => {
  const network = vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'/menu'}}))
    .mockResolvedValueOnce(new Response('menu',{headers:{'content-type':'text/html'}}));
  expect((await fetchSource(network,'https://food.example/start')).url).toBe('https://food.example/menu');
  expect(network.mock.calls[0][1].redirect).toBe('manual');
  network.mockReset().mockResolvedValue(new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}}));
  await expect(fetchSource(network,'https://food.example/start')).rejects.toThrow(/public/i);
  expect(network).toHaveBeenCalledTimes(1);
});
it.each(['application/json','application/octet-stream','', 'image/svg+xml'])('[manual] FETCH-R03 rejects unsupported or missing MIME %s', async type => {
  await expect(fetchSource(vi.fn().mockResolvedValue(new Response(new Uint8Array([1]),{headers:type?{'content-type':type}:{}})), 'https://food.example/menu.pdf')).rejects.toThrow(/content.type/i);
});
it('[manual] FETCH-R04 rejects declared and streamed oversized bodies and cancels the stream', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(MAX_SOURCE_BYTES));c.enqueue(new Uint8Array([1]));}, cancel});
  await expect(fetchSource(vi.fn().mockResolvedValue(new Response(stream,{headers:{'content-type':'text/html'}})), 'https://food.example/menu')).rejects.toThrow(/large/i);
  expect(cancel).toHaveBeenCalled();
  await expect(fetchSource(vi.fn().mockResolvedValue(new Response(null,{headers:{'content-type':'text/html','content-length':String(MAX_SOURCE_BYTES+1)}})), 'https://food.example/menu')).rejects.toThrow(/large/i);
});
it('[manual] FETCH-R05 aborts a stalled request and a stalled response body at the deadline', async () => {
  vi.useFakeTimers();
  for (const stallBody of [false,true]) {
    let signal: AbortSignal | undefined;
    const network = vi.fn().mockImplementation((_url,init) => {signal=init.signal; return stallBody ? Promise.resolve(new Response(new ReadableStream(),{headers:{'content-type':'text/html'}})) : new Promise(()=>{});});
    const request = expect(fetchSource(network,'https://food.example/menu')).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(SOURCE_TIMEOUT_MS);
    await request;
    expect(signal?.aborted).toBe(true);
  }
});
it('[manual] FETCH-R06 rejected import leaves the existing menu intact and skips storage and model work', async () => {
  const db=testDb(); await createRestaurant(db,{id:'r1',name:'Food',address:'Main'});
  const previous=await storeMenu(db,{restaurantId:'r1',sourceUrl:null,sourceType:'html',snapshotKey:'old',status:'active',attempts:1,dishes:easyMenu.dishes});
  const llm=mockLlm([]); const blobs=memoryBlobs();
  await expect(importMenu({db,llm,blobs,fetch:vi.fn()}, {restaurantId:'r1',url:'http://localhost/menu'})).rejects.toThrow();
  expect((await db.prepare("SELECT id FROM menus WHERE status = 'active'").all()).results).toEqual([{id:previous}]);
  expect(blobs.store.size).toBe(0); expect(llm.calls).toHaveLength(0);
});
it('[manual] FETCH-R07 rendering rejects a streamed oversized source before rendering or model work', async () => {
  const render=vi.fn(); const cancel=vi.fn();
  const source=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(MAX_SOURCE_BYTES+1));},cancel});
  const fetcher=renderingFetch(vi.fn().mockResolvedValue(new Response(source,{headers:{'content-type':'text/html'}})),render);
  await expect(fetchSource(fetcher,'https://food.example/menu')).rejects.toThrow(/large/i);
  expect(cancel).toHaveBeenCalled(); expect(render).not.toHaveBeenCalled();
});
