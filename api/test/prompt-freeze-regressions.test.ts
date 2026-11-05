// Manually reviewed and refined by the user. Uses disposable Git repositories only.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {checkPromptsFrozen} from '../src/validation/runner';
let root:string;
const git=(args:string[])=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});return {ok:r.status===0,out:r.stdout};};
beforeEach(()=>{
 root=mkdtempSync(tmpdir()+'/prompt-freeze-');mkdirSync(root+'/api/src/prompts',{recursive:true});writeFileSync(root+'/api/src/prompts/menu.ts','export const prompt="frozen";');
 execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});
 execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture'],{cwd:root});execFileSync('git',['tag','frozen'],{cwd:root});
});
afterEach(()=>rmSync(root,{recursive:true,force:true}));
it('[manual] FREEZE-R01 unchanged prompt tree matches its actual Git tag',()=>expect(()=>checkPromptsFrozen('frozen',git)).not.toThrow());
it.each(['unstaged','staged','new-staged'])('[manual] FREEZE-R02 rejects %s prompt edits against real Git',mode=>{
 const file=mode==='new-staged'?'new.ts':'menu.ts';writeFileSync(root+'/api/src/prompts/'+file,'changed');
 if(mode!=='unstaged')execFileSync('git',['add','api/src/prompts'],{cwd:root});
 expect(()=>checkPromptsFrozen('frozen',git)).toThrow(/differ from tag frozen/);
});
it('[manual] FREEZE-R03 untracked new prompt files must invalidate the freeze',()=>{
 writeFileSync(root+'/api/src/prompts/new.ts','new prompt');expect(()=>checkPromptsFrozen('frozen',git)).toThrow(/differ|untracked/);
});
