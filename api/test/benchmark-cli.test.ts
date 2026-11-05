// Runs the real CLI entrypoints and package command arguments with isolated service stubs.
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';
const apiRoot=import.meta.dirname+'/../';
const scripts=JSON.parse(readFileSync(apiRoot+'package.json','utf8')).scripts;
it.each([['benchmark','benchmark.ts'],['coverage:a3','coverage-a3.ts']])('[manual] CLI-R01 %s loads api/.dev.vars and passes path/tag/credentials to execution', (command,entry)=>{
 const root=mkdtempSync(tmpdir()+'/benchmark-cli-');
 const put=(file:string,body:string)=>writeFileSync(root+'/'+file,body);
 try {
  for(const dir of ['api/scripts','api/src/llm','api/src/menu','api/src/validation'])mkdirSync(root+'/'+dir,{recursive:true});
  put('package.json','{"type":"module"}');
  put('api/.dev.vars','PROMPT_TAG=fixture-freeze\nLLM_BRIDGE_URL=http://127.0.0.1:8790\nAPIFY_TOKEN=fixture-apify\n');
  put('api/scripts/'+entry,readFileSync(apiRoot+'scripts/'+entry,'utf8'));
  put('api/src/llm/select.ts','export const selectLlm = (args) => args;');
  put('api/src/menu/render.ts','export const renderingFetch = () => {throw new Error("unexpected rendering");};');
  put('api/src/validation/playwright-render.ts','export const playwrightRender = () => {throw new Error("unexpected rendering");};');
  put('api/src/validation/runner.ts',`
   export const checkPromptsFrozen = (tag) => {if(tag !== 'fixture-freeze') throw new Error('env tag not loaded');};
   export const snapshotFetch = () => {throw new Error('unexpected snapshots');};
   export const runBenchmark = async (opts) => {console.log('EXECUTION '+JSON.stringify({promptTag:opts.promptTag,llm:opts.llm}));return {restaurants:[]};};
  `);
  put('api/src/validation/coverage.ts',`export const runCoverage = async (opts) => {console.log('EXECUTION '+JSON.stringify({promptTag:opts.promptTag,llm:opts.llm,apifyToken:opts.apifyToken}));return {restaurants:[]};};`);
  execFileSync('git',['init','-q'],{cwd:root});
  const args:string[]=scripts[command].split(/\s+/);expect(args.shift()).toBe('tsx');
  const env={...process.env};for(const key of ['PROMPT_TAG','ANTHROPIC_API_KEY','LLM_BRIDGE_URL','APIFY_TOKEN'])delete env[key];
  const stdout=execFileSync(process.execPath,[fileURLToPath(import.meta.resolve('tsx/cli')),...args],{cwd:root+'/api',env,encoding:'utf8'});
  const output=JSON.parse(stdout.split('\n').find(line=>line.startsWith('EXECUTION '))!.slice('EXECUTION '.length));
  expect(output).toMatchObject({promptTag:'fixture-freeze',llm:{bridgeUrl:'http://127.0.0.1:8790'}});
  if(command==='coverage:a3')expect(output.apifyToken).toBe('fixture-apify');
 } finally {rmSync(root,{recursive:true,force:true});}
});
