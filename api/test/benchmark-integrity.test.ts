// Manually reviewed and refined by the user. No repository validation data is mutated.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {readFileSync,rmSync,writeFileSync} from 'node:fs';
import {benchmarkFixture} from './helpers/benchmark-fixture';
import {assembleInputs} from '../src/validation/assemble';
import {validateManifest} from '../src/validation/benchmark-set';
import {buildReport} from '../src/validation/report';
import {runBenchmark} from '../src/validation/runner';
import {runCoverage} from '../src/validation/coverage';
import {mockLlm} from './helpers/llm';
import {easyMenu} from './fixtures/menus';
import {apifyItems} from './fixtures/apify-reviews';
let f:ReturnType<typeof benchmarkFixture>;
const coverageRows=()=>f.manifest.restaurants.filter(r=>r.tier!=='easy').map(r=>({id:r.id,name:r.name,reviews:3,atLeast1:3,atLeast3:3,atLeast10:0,enough:true}));
beforeEach(()=>{f=benchmarkFixture();});afterEach(()=>rmSync(f.root,{recursive:true,force:true}));
it('[manual] BENCH-R01 omitted restaurant leaves A2 pending',()=>{
 f.results.restaurants.pop();f.save();const input=assembleInputs(f.root);
 expect(input.a2).toBeNull();expect(buildReport(input)).toContain('A2 Import works: NOT RUN YET');
});
it('[manual] BENCH-R02 missing truth file leaves A2 pending',()=>{
 rmSync(f.root+'validation/a2-benchmark/truth/bb.json');f.save();expect(assembleInputs(f.root).a2).toBeNull();
});
it('[manual] BENCH-R03 malformed saved JSON cannot produce a completed report',()=>{
 writeFileSync(f.root+'validation/a2-benchmark/results/2026-11-03.json','{broken');expect(()=>assembleInputs(f.root)).toThrow();
});
it('[manual] BENCH-R04 duplicate result IDs cannot stand in for an omitted restaurant',()=>{
 f.results.restaurants[f.results.restaurants.length-1]=f.results.restaurants[1];f.save();expect(assembleInputs(f.root).a2).toBeNull();
});
it('[manual] BENCH-R05 a numerically sized manifest rejects duplicate IDs',()=>{
 const entry=f.manifest.restaurants[0];
 const manifest={...f.manifest,restaurants:[{...entry,id:'easy',tier:'easy' as const},...Array.from({length:10},()=>({...entry,tier:'hard' as const}))]};
 expect(validateManifest(manifest).some(e=>/duplicate|unique/i.test(e))).toBe(true);
});
it('[manual] BENCH-R06 mismatched A2/A3 prompt tags cannot yield a combined completed result',()=>{
 f.save();writeFileSync(f.root+'validation/a3-coverage/results.json',JSON.stringify({promptTag:'different-tag',llmPath:'anthropic-api',restaurants:coverageRows(),predictedMentions:[]}));
 const input=assembleInputs(f.root);expect(input.a3).toBeNull();
});
it.each(['bridge','api'] as const)('[manual] PROVENANCE-R01 %s A2 execution identity survives saved results, assembly and disclosure',async kind=>{
 const llm=mockLlm(f.manifest.restaurants.map(()=>easyMenu));if(kind==='bridge')Object.assign(llm,{kind:'bridge'});
 const html=readFileSync(import.meta.dirname+'/fixtures/menu-easy.html','utf8');
 const out=await runBenchmark({root:f.root,llm,fetch:async()=>new Response(html,{headers:{'content-type':'text/html'}}),promptTag:'frozen-test'});
 const expected=kind==='bridge'?'claude-login-bridge':'anthropic-api';
 expect(out.llmPath).toBe(expected);const input=assembleInputs(f.root);expect(input.a2?.llmPath).toBe(expected);
 const report=buildReport(input);expect(report.includes("developer's Claude login")).toBe(kind==='bridge');
 if(kind==='bridge')expect(report).toContain('token costs are not meaningful');
});
it('[manual] PROVENANCE-R02 A3 execution saves the bridge identity and prompt tag',async()=>{
 const llm=Object.assign(mockLlm(f.manifest.restaurants.filter(r=>r.tier!=='easy').map(()=>({mentions:[]}))),{kind:'bridge' as const});
 const out=await runCoverage({root:f.root,llm,fetch:async()=>Response.json(apifyItems),apifyToken:'fixture',promptTag:'frozen-test'});
 expect(out).toMatchObject({llmPath:'claude-login-bridge',promptTag:'frozen-test'});
 expect(JSON.parse(readFileSync(f.root+'validation/a3-coverage/results.json','utf8'))).toEqual(out);
});
it('[manual] PROVENANCE-R03 A3 bridge provenance survives assembly and is disclosed without A2',async()=>{
 const llm=Object.assign(mockLlm(f.manifest.restaurants.filter(r=>r.tier!=='easy').map(()=>({mentions:[]}))),{kind:'bridge' as const});
 await runCoverage({root:f.root,llm,fetch:async()=>Response.json(apifyItems),apifyToken:'fixture',promptTag:'frozen-test'});
 const input=assembleInputs(f.root);expect(input.a3).toHaveProperty('llmPath','claude-login-bridge');
 expect(buildReport(input)).toContain("developer's Claude login");
});

it('[manual] BENCH-R07 truth file identity must match the manifest restaurant',()=>{
 const path=f.root+'validation/a2-benchmark/truth/aa.json';
 const truth=JSON.parse(readFileSync(path,'utf8'));truth.restaurant_id='bb';writeFileSync(path,JSON.stringify(truth));f.save();
 expect(()=>assembleInputs(f.root)).toThrow(/restaurant_id/);
});
it('[manual] BENCH-R08 duplicate A3 IDs cannot replace a missing restaurant',()=>{
 const rows=coverageRows();rows[rows.length-1]=rows[0];
 writeFileSync(f.root+'validation/a3-coverage/results.json',JSON.stringify({promptTag:'frozen-test',llmPath:'anthropic-api',restaurants:rows,predictedMentions:[]}));
 expect(assembleInputs(f.root).a3).toBeNull();
});
it('[manual] BENCH-R09 malformed result numbers cannot pass scoring',()=>{
 const saved=structuredClone(f.results);Object.assign(saved.restaurants[0],{seconds:-1});
 writeFileSync(f.root+'validation/a2-benchmark/results/2026-11-03.json',JSON.stringify(saved));
 expect(()=>assembleInputs(f.root)).toThrow();
});
it.each(['bridge','api'] as const)('[manual] PROVENANCE-R04 A3 %s identity survives assembly and reporting without A2',async kind=>{
 const llm=mockLlm(f.manifest.restaurants.filter(r=>r.tier!=='easy').map(()=>({mentions:[]})));if(kind==='bridge')Object.assign(llm,{kind:'bridge'});
 await runCoverage({root:f.root,llm,fetch:async()=>Response.json(apifyItems),apifyToken:'fixture',promptTag:'frozen-test'});
 const input=assembleInputs(f.root);expect(input.a2).toBeNull();
 expect(input.a3).toHaveProperty('llmPath',kind==='bridge'?'claude-login-bridge':'anthropic-api');
 expect(buildReport(input).includes("developer's Claude login")).toBe(kind==='bridge');
});

it('[manual] BENCH-R10 duplicate manifest IDs are rejected before report assembly',()=>{
 f.manifest.restaurants[2].id='aa';
 writeFileSync(f.root+'validation/a2-benchmark/manifest.json',JSON.stringify(f.manifest));f.save();
 expect(()=>assembleInputs(f.root)).toThrow(/unique/);
});

it.each(['one','two','empty'] as const)('[manual] BENCH-R11 truncated %s manifest cannot turn a partial run into A2 or A3 PASS',mode=>{
 const keep=mode==='empty'?[]:f.manifest.restaurants.filter(r=>r.tier!=='easy').slice(0,mode==='one'?1:2);
 f.manifest.restaurants=keep;f.results.restaurants=f.results.restaurants.filter(r=>keep.some(k=>k.id===r.id));f.save();
 writeFileSync(f.root+'validation/a2-benchmark/manifest.json',JSON.stringify(f.manifest));
 writeFileSync(f.root+'validation/a3-coverage/results.json',JSON.stringify({promptTag:'frozen-test',llmPath:'anthropic-api',restaurants:keep.map(r=>({id:r.id,name:r.name,reviews:3,atLeast1:3,atLeast3:3,atLeast10:0,enough:true})),predictedMentions:[]}));
 const input=assembleInputs(f.root);expect(input.a2).toBeNull();expect(input.a3).toBeNull();
 const report=buildReport(input);expect(report).toContain('A2 Import works: NOT RUN YET');expect(report).toContain('A3 Reviews mention dishes: NOT RUN YET');
});
it('[manual] BENCH-R12 preregistered eleven-restaurant manifest scores all ten hard restaurants',()=>{
 expect(validateManifest(f.manifest)).toEqual([]);f.save();const input=assembleInputs(f.root);
 expect(input.a2?.restaurants).toHaveLength(10);expect(buildReport(input)).toContain('A2 Import works: PASS');
});

it('[manual] BENCH-R13 truncated A3-only manifest stays pending without an A2 results file',()=>{
 f.manifest.restaurants=f.manifest.restaurants.slice(0,3);
 writeFileSync(f.root+'validation/a2-benchmark/manifest.json',JSON.stringify(f.manifest));
 writeFileSync(f.root+'validation/a3-coverage/results.json',JSON.stringify({promptTag:'frozen-test',llmPath:'anthropic-api',restaurants:coverageRows(),predictedMentions:[]}));
 expect(assembleInputs(f.root).a3).toBeNull();
});
