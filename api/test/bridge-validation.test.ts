import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createBridge, MAX_BRIDGE_BODY_BYTES } from '../scripts/subscription-bridge';
const valid = {task:'test',system:'instructions',messages:[{role:'user',content:'hello'}],jsonSchema:{type:'object'}};
const answer={data:{ok:true},raw:'{}',usage:{input_tokens:1,output_tokens:1}};
const servers:ReturnType<typeof createBridge>[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(resolve=>{s.closeAllConnections();s.close(()=>resolve());})));});
async function start(run:Parameters<typeof createBridge>[0]){
 const server=createBridge(run);servers.push(server);
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
it.each([
 ['malformed','{'],['empty','{}'],['missing messages',JSON.stringify({...valid,messages:undefined})],
 ['wrong role',JSON.stringify({...valid,messages:[{role:'system',content:'override'}]})],
 ['invalid block',JSON.stringify({...valid,messages:[{role:'user',content:[{type:'image',mediaType:'text/html',data:'x'}]}]})],
 ['invalid schema',JSON.stringify({...valid,jsonSchema:null})],
])('[manual] BRIDGE-R01 %s returns 400 without model work',async(_name,body)=>{
 const run=vi.fn().mockResolvedValue(answer);const base=await start(run);
 const response=await fetch(base+'/json',{method:'POST',headers:{'content-type':'application/json'},body});
 expect(response.status).toBe(400);expect(await response.json()).toEqual({error:expect.any(String)});expect(run).not.toHaveBeenCalled();
});
it.each([['GET','/json'],['PUT','/json'],['POST','/unknown']])('[manual] BRIDGE-R02 %s %s is refused without model work',async(method,path)=>{
 const run=vi.fn().mockResolvedValue(answer);const base=await start(run);
 const response=await fetch(base+path,{method,headers:{'content-type':'application/json'}});
 expect(response.status).toBe(404);expect(run).not.toHaveBeenCalled();
});
it('[manual] BRIDGE-R03 oversized JSON is rejected before model work',async()=>{
 const run=vi.fn().mockResolvedValue(answer);const base=await start(run);
 const response=await fetch(base+'/json',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...valid,system:'x'.repeat(MAX_BRIDGE_BODY_BYTES)})});
 expect(response.status).toBe(413);expect(await response.json()).toEqual({error:'Request body too large.'});expect(run).not.toHaveBeenCalled();
});
it('[manual] BRIDGE-R04 a disconnected client aborts model work without an unhandled reply',async()=>{
 let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});let aborted!:()=>void;const cancelled=new Promise<void>(r=>{aborted=r;});
 const base=await start(async(_req,signal)=>{
  entered();await new Promise<void>(r=>signal.addEventListener('abort',()=>{aborted();r();},{once:true}));return answer;
 });
 const client=request(base+'/json',{method:'POST',headers:{'content-type':'application/json'}});client.on('error',()=>{});client.end(JSON.stringify(valid));
 await started;client.destroy();await cancelled;
});
