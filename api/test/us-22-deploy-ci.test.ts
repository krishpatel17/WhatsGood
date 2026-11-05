import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import app from "../src/index";

const root = import.meta.dirname + "/../../";
const read = (p: string) => readFileSync(root + p, "utf8");

type Step = { name?: string; run?: string; uses?: string; with?: Record<string, unknown>; "continue-on-error"?: boolean; if?: string };

function ciSteps(): Step[] {
  const wf = parse(read(".github/workflows/ci.yml"));
  return Object.values(wf.jobs as Record<string, { steps: Step[] }>).flatMap((j) => j.steps);
}

describe("US-22 Deploy on Cloudflare with CI", () => {
  it("[manual] US22-R01 CI runs the workspace test runner with coverage and propagates failure", () => {
    const testStep = ciSteps().find((s) => s.run?.trim() === "npm run coverage");
    expect(testStep, "a step running the suite with coverage").toBeDefined();
    expect(testStep!["continue-on-error"]).not.toBe(true);
    const scripts=JSON.parse(read("package.json")).scripts;
    expect(scripts.coverage).toBe("npm run coverage --workspaces --if-present");
    for (const workspace of ["api","web"]) expect(JSON.parse(read(`${workspace}/package.json`)).scripts.coverage).toBe("vitest run --coverage");
  });

  it("[ai] T2 ci: the coverage report is uploaded as an artifact even when tests fail", () => {
    const upload = ciSteps().find((s) => s.uses?.startsWith("actions/upload-artifact"));
    expect(upload).toBeDefined();
    expect(String(upload!.with?.path)).toContain("coverage");
    expect(upload!.if).toBe("always()");
  });

  it("[ai] T3 smoke: GET /health returns 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("[ai] AC1: wrangler config binds D1 and R2 for the Worker", () => {
    const toml = read("api/wrangler.toml");
    expect(toml).toMatch(/\[\[d1_databases\]\]/);
    expect(toml).toMatch(/\[\[r2_buckets\]\]/);
  });

  it("[manual] US22-R02 config-only check: wrangler has no inline credentials and .dev.vars is ignored", () => {
    expect(read(".gitignore")).toMatch(/^\.dev\.vars$/m);
    const toml = read("api/wrangler.toml");
    expect(toml).not.toMatch(/sk-ant-|ANTHROPIC_API_KEY\s*=|APIFY_TOKEN\s*=/);
    expect(existsSync(root + "api/.dev.vars.example")).toBe(true);
  });
});
