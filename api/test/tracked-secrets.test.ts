import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

const root=join(import.meta.dirname,'../..');
it('[manual] US22-S01 scans every tracked text path and reports a nested credential without exposing its value',()=>{
  const dir=mkdtempSync(join(tmpdir(),'wg-secret-fixture-'));
  try {
    execFileSync('git',['init','-q',dir]); mkdirSync(join(dir,'nested'));
    const value=['sk','ant','api03', 'x'.repeat(40)].join('-');
    writeFileSync(join(dir,'nested','fixture.txt'),value);
    execFileSync('git',['add','.'],{cwd:dir});
    const output=execFileSync(process.execPath,['--input-type=module','-e',`import {scanTracked} from ${JSON.stringify(pathToFileURL(join(root,'scripts/check-secrets.mjs')).href)}; console.log(JSON.stringify(scanTracked(${JSON.stringify(dir)})));`],{encoding:'utf8'});
    expect(JSON.parse(output)).toEqual(['nested/fixture.txt']);
    expect(output).not.toContain(value);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
it('[manual] US22-S02 current tracked files contain no recognized credential patterns',()=>{
  const result=execFileSync(process.execPath,[join(root,'scripts/check-secrets.mjs')],{cwd:root,encoding:'utf8'});
  expect(result).toContain('No recognized credential patterns');
});
