// Synthetic, isolated files for manually specified benchmark integrity/provenance cases.
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {easyMenu} from '../fixtures/menus';
import type {BenchmarkResults} from '../../src/validation/runner';
export function benchmarkFixture() {
 const root=mkdtempSync(tmpdir()+'/benchmark-review-')+'/';
 for(const dir of ['validation/a2-benchmark/truth','validation/a2-benchmark/results','validation/a3-coverage'])mkdirSync(root+dir,{recursive:true});
 const restaurants=['easy','aa','bb','cc','dd','ee','ff','gg','hh','ii','jj'].map(id=>({id,survey_id:id,name:`Restaurant ${id}`,tier:id==='easy'?'easy' as const:'hard' as const,source_type:'html',menu_url:`https://${id}.example/menu`,review_source:'google-maps',maps_url:`https://maps.example/${id}`}));
 const manifest={created:'2026-11-03',rule:'isolated test fixture',restaurants};
 writeFileSync(root+'validation/a2-benchmark/manifest.json',JSON.stringify(manifest));
 for(const {id} of restaurants)writeFileSync(root+`validation/a2-benchmark/truth/${id}.json`,JSON.stringify({restaurant_id:id,copied_by:'Fixture',copied_on:'2026-11-03',source_url:'https://example.com',dishes:easyMenu.dishes.map(({name,section,price})=>({name,section,price}))}));
 const results:BenchmarkResults={promptTag:'frozen-test',model:'test-model',llmPath:'anthropic-api',startedAt:'2026-11-03T00:00:00.000Z',restaurants:restaurants.map(({id,tier})=>({id,tier,sourceType:'html',status:'active',failure:null,seconds:10,retries:0,inputTokens:10,outputTokens:5,costUsd:0,snapshot:null,dishes:easyMenu.dishes}))};
 const save=()=>writeFileSync(root+'validation/a2-benchmark/results/2026-11-03.json',JSON.stringify(results));
 return {root,manifest,results,save};
}
