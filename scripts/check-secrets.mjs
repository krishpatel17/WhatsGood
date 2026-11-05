// Scan the current tracked tree, reporting filenames only. This is a heuristic,
// not a credential audit of deleted files or earlier Git history.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function containsCredential(text) {
  return /sk-ant-(?:api\d+-)?[A-Za-z0-9_-]{30,}|\b(?:ghp|github_pat)_[A-Za-z0-9_]{30,}|\bAKIA[A-Z0-9]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text);
}
export function scanTracked(root = process.cwd()) {
  return execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).filter(file => {
    const content=readFileSync(resolve(root,file));
    return !content.includes(0) && containsCredential(content.toString('utf8'));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings=scanTracked();
  if (findings.length) {console.error('Possible credentials in tracked files:\n'+findings.join('\n')); process.exitCode=1;}
  else console.log('No recognized credential patterns in tracked text files.');
}
