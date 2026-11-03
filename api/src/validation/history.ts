// Node-only helpers that read git history to prove what was committed before what (bias protection).
import { execFileSync } from "node:child_process";
import { parseCsv } from "./csv";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** Commits that touched a file, oldest first. */
export function commitsTouching(path: string): string[] {
  const root = git("rev-parse", "--show-toplevel").trim();
  return execFileSync("git", ["log", "--format=%H", "--reverse", "--", path], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
}

export function fileAt(commit: string, path: string): string | null {
  try {
    return git("show", `${commit}:${path}`);
  } catch {
    return null;
  }
}

export function commitTime(commit: string): number {
  return Number(git("show", "-s", "--format=%ct", commit).trim()) * 1000;
}

/**
 * Finds the first commit where the survey lists its restaurants with every
 * source column empty, and the first where every source column is filled.
 */
export function listCommitPredatesFill(path: string) {
  const commits = commitsTouching(path);
  let listIndex = -1;
  let fillIndex = -1;
  commits.forEach((c, i) => {
    const text = fileAt(c, path);
    if (!text) return;
    const rows = parseCsv(text);
    if (rows.length === 0) return;
    if (listIndex < 0 && rows.every((r) => !r.source_type)) listIndex = i;
    if (fillIndex < 0 && rows.every((r) => r.source_type)) fillIndex = i;
  });
  return {
    listCommit: listIndex >= 0 ? commits[listIndex] : null,
    listIndex,
    fillCommit: fillIndex >= 0 ? commits[fillIndex] : null,
    fillIndex: fillIndex >= 0 ? fillIndex : null,
  };
}
