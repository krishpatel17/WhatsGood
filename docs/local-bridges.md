# Local Claude and Codex bridges

The Worker and validation commands share the same local bridge client. Both bridges implement `POST /json` with text, image and PDF content and expose `GET /health`. They bind only to `127.0.0.1`; they are for one developer's own machine, not a deployed or shared service.

## Start either or both servers

```powershell
npm run bridge:claude -w api
```

```powershell
npm run bridge:codex -w api
```

Run these in separate terminals. Claude uses port **8790**; Codex uses **8791**. The existing `npm run bridge -w api` command remains an alias for the Claude/Claude Code bridge. Claude continues to use the Claude Agent SDK and its existing login.

Claude Code must be signed in locally before live Claude checks can work. If the server reports `Not logged in`, finish Claude Code sign-in on your machine and retry; starting its HTTP server alone does not authenticate it.

Codex requires an installed Codex CLI with `codex exec --ignore-user-config` support. Run `codex login`, then `codex login status`; the Codex bridge verifies ChatGPT subscription login before listening. It uses the documented [non-interactive CLI](https://learn.chatgpt.com/docs/non-interactive-mode) and [CLI options](https://learn.chatgpt.com/docs/cli/reference). It never reads or copies authentication tokens. Inherited `OPENAI_API_KEY`, `CODEX_API_KEY` and `OPENAI_BASE_URL` are removed from the child environment. The CLI's existing `CODEX_HOME` is preserved for login.

On Windows, the bridge finds the native CLI or the npm-installed `@openai/codex/bin/codex.js` on PATH without invoking a shell. For a custom installation set `CODEX_CLI_PATH` to the native executable or its JavaScript entrypoint; `.cmd`, `.bat` and `.ps1` wrappers are intentionally unsupported.

## Choose the app's provider

Put one configuration in the ignored `api/.dev.vars`, then restart `wrangler dev`. The benchmark and A3 commands read the same file on startup.

| Provider | `LLM_BRIDGE_PROVIDER` | `LLM_BRIDGE_URL` | Model default |
|---|---|---|---|
| Claude / Claude Code | `claude` | `http://127.0.0.1:8790` | Same model as the Anthropic API adapter |
| Codex | `codex` | `http://127.0.0.1:8791` | CLI default, reported as `codex-cli-default` |

Codex example:

```dotenv
LLM_BRIDGE_PROVIDER=codex
LLM_BRIDGE_URL=http://127.0.0.1:8791
# Optional reproducibility setting: select an explicit model available to your login.
# LLM_BRIDGE_MODEL=your-model-id
```

Use `LLM_BRIDGE_MODEL` to pin either provider's model. Omitting the provider with an existing loopback URL preserves the old Claude behavior. An explicit unknown provider, missing bridge URL or non-loopback URL fails rather than silently switching to API billing. The servers and client reject mismatched providers; the Codex server requires an explicitly labelled Codex request.

To use the Anthropic API directly, unset the bridge variables and configure `ANTHROPIC_API_KEY`. Review collection still requires `APIFY_TOKEN` for every model path. Subscription usage limits apply to local bridge calls.

## Validate the connection

With the selected server running:

```powershell
npm run bridge:check -w api
npm run bridge:check -w api -- --media
```

The first command checks a small live text extraction. `--media` adds image and PDF checks using a generated menu with a known name/price. Each check consumes one model call. Output identifies the provider, configured model and token usage. Automated tests use injected runners and fake child executables, so the test suite needs neither a CLI login nor paid credentials.

The full existing validation commands remain:

```powershell
npm run benchmark -w api -- --render
npm run coverage:a3 -w api
```

These retain the frozen-prompt gate and existing benchmark behavior. They write the normal validation results; use the small smoke checks for connectivity testing without rerunning or overwriting validation artifacts. This change does not alter the import prompts, answer keys or Alpha results.

## Runtime and evidence boundaries

- Claude receives PDF documents natively. Codex receives locally rasterized PNG pages in order, capped at 20 total attached images/pages per request and a maximum image edge of 2400 pixels. Different input paths and CLI overhead affect cross-provider comparisons.
- Codex calls run in a temporary working directory with a read-only sandbox, shell tool disabled, user CLI configuration ignored and ephemeral sessions. Only supplied request text and attachments are placed there. Files are cleaned on success, failure and cancellation. Prompts and paths are passed as process arguments/stdin without shell interpolation.
- Disconnecting the HTTP client aborts model work. Codex has a 120-second request timeout, including media conversion, and kills only that request's process tree on cancellation. The benchmark's separate deadline remains unchanged.
- New benchmark files record `codex-login-bridge` or `claude-login-bridge` and the configured model. A3 also records model identity. Subscription `costUsd` is `null`, because Claude API rates cannot price a subscription run. Older numeric cost records remain readable. Reports disclose the selected subscription path and PDF conversion for Codex.
- `codex-cli-default` is an honest unpinned-model label, not an exact model version. Pin a model before making reproducible model comparisons. Changing a model/provider is not evidence that a prior Alpha result has improved.

## Validation record

Local Windows validation on 2026-11-05:

- `npm run coverage`: 338 API tests and 43 web tests passed. API line coverage 96.52%; web line coverage 89.65%; all configured thresholds passed. CLI runner tests are included in the test counts but CLI scripts are outside the existing source-coverage scope.
- `npm run typecheck -w api` and `npm run build -w web` passed.
- `npx wrangler deploy --dry-run` bundled the Worker successfully; no deployment was performed.
- `npm run e2e -w web`: all 19 browser tests passed using Edge.
- Live Codex text, image and PDF smoke checks passed through the HTTP bridge with ChatGPT login.
- Claude bridge contract tests passed and its server started alongside Codex. The live Claude smoke returned `Not logged in`; its account-dependent completion path has not been verified on this machine.
- Existing Windows test-harness errors were fixed separately: ESM imports use file URLs, and Playwright passes the API URL through its environment rather than POSIX-only shell assignment syntax.

No original validation data, importer prompts or Alpha verdict was regenerated for these checks.
