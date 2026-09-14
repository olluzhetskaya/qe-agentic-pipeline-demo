# AGENTS.md — Requirement-to-Automation Test Pipeline Demo

Reference implementation for ADR-014
(`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`).

This file is **standing constraints**, always in context. It is not a
runbook. The e2e pipeline is the slash command `/qe-pipeline`
(`.cursor/commands/qe-pipeline.md`) — invoke that only when the user wants
the full flow.

## Writing — ASD-STE100 and ISO 24495-1

Write all agent output to ASD-STE100 Simplified Technical English and
ISO 24495-1 Plain language.

ASD-STE100 (word and sentence):

- Use simple technical words. Prefer one word for one meaning.
- Write short sentences. Give one instruction or one fact in each sentence.
- Use active voice. Name the actor, then the action.
- Use the imperative for procedures. Use the simple present for descriptions.
- Do not use slang, idioms, or filler.

ISO 24495-1 (find, understand, use):

- Give readers only the information they need for the task.
- Put the purpose and the result first.
- Use headings and lists so readers can find each point.
- Write so a reader can act without extra explanation.

This rule applies to chat replies, wiki text, agent definitions, skills,
review verdicts, and draft PR copy. It does not rewrite identifiers, JSON
keys, matcher names, or other code tokens.

## Coordinator vs isolated agents

You are the coordinator in this chat. Apply skills here. Spawn a subagent
only when isolation or a narrower tool set is required:

| Agent | Why isolated |
|---|---|
| `test-design-reviewer` | Must not share the author's context |
| `xray-publisher` | MCP writes — propose-then-confirm |
| `code-reviewer` | Must not share the author's context |
| `pr-drafter` | No terminal; draft only |

Judge subagents write a typed verdict and return its human-readable rendering.
They do not name or spawn the next step.

## Data layer

If a case needs data that is not in `src/data/`, **create** a typed fixture
there (and re-export via `src/fixtures/`) before writing the spec. Tests
never hard-code tenant IDs, plan names, or employee IDs. Specs import from
`@fixtures` only — never `@playwright/test`. See the `data-layer` skill.

## Wiki

`wiki/` is the only place business detail lives. Read it before generating or
reviewing anything that touches tenant onboarding, and put new business
knowledge there — not in a gate, a prompt, or a fixture comment. Each rule
carries structured lines the harness parses (`src/validation/wiki-rules.ts`):
`Design:` techniques, `Failure mode:` phrases, an `Assertion:` contract, a
`wiki/sensitive_domains.md` declares the paths that force manual review.
Adding a wiki file is expected; hardcoding a rule phrase, tier policy, or count
in a validator is not. Data gates enforce fixture location, schema shape,
readonly fields, and exports—not uniqueness or other generic lint smells.
Do not
put a story test plan in the wiki; that artifact is `data/test-design.json`.

## Evidence and confidence

Requirement-analysis handoffs and isolated review verdicts include an integer
confidence score from 0–100 with a short rationale. The standing PASS cutoff
is 75 with `threshold_basis: "policy"` — it is a declared policy, not a
measured calibration. `golden_dataset/` primes the judge; it is not a
blinded holdout. Confidence below that cutoff cannot PASS: persist
`analysis_decision.status: "WAITING"` with a non-empty `reason` and
`escalate` array, or a judge `FAIL` with `escalate` naming the missing
evidence.

Isolated judges can read sources and write only their assigned verdict file.
Before spawn, generate `REVIEW_CONTEXT` with `npm run verdict:context`. The
judge writes `agent`, `target`, `target_sha256`, `verdict`, `confidence`,
`rationale`, typed `findings`, `escalate`, and `reviewed_at` under `data/verdicts/`.
After return, route only from `npm run verdict:check`; prose is a
human-readable rendering, not a control input. `stop` will not write
`out/draft_pr.md` without a hash-fresh PASS from `test-design-reviewer` on
`data/test-design.json` and from `code-reviewer` on each
`src/tests/*.spec.ts`.

Never invent a value that is absent from Jira, wiki, fixtures, artifacts, or
tool output. In structured artifacts write JSON `null`; in review output write
`null`. Do not substitute `"unknown"`, `"N/A"`, `"TBD"`, an empty string, or a
plausible guess. Confidence does not make an invented value acceptable.

## Run state

`data/run-state.json` is the resumable pointer. Update it when a stage
completes. Do not set `stage` to `1a_generation` or later until
`0e_xray_publish` is `pass` and every case has a non-null `xray_key`.
`data/xray-index.json` is a generated Xray catalogue (gitignored). Fetch
it once per run, diff locally, and treat it as stale when `fetched_at` is
older than `data/run-state.json`. If that file exists and its
`requirement_id` matches the design, every Manual case must already carry
`xray_key`. `automated_by` may only point under `src/tests/`;
`golden_dataset/` is calibration, not traceability.

## Assertions

Always assert on a Locator with a web-first matcher (`toBeEnabled()`,
`toBeVisible()`, `toHaveText()`). Never wrap element state in a boolean
method and assert `.toBe(true)`. See `src/pages/` and `golden_dataset/dirty/`.

## Hard boundaries

- `xray-publisher` never creates an Xray issue without proposing content
  and getting explicit confirmation. Fetch the requirement's tests once
  (`search`), cache `data/xray-index.json`, and diff locally. Propose only
  missing cases as one list. The fail-closed `beforeMCPExecution`
  hook allows only clear reads from identified MCP servers. It returns `ask`
  for writes, unknown tools, and missing server identity. Thus, each Xray
  write requires approval for that exact tool call.
  This MCP gate is **local only**. Cursor cloud agents do not run
  `beforeMCPExecution` or `sessionStart`. Do not provision `XRAY_CLIENT_ID`
  or `XRAY_CLIENT_SECRET` to a cloud agent. `xray-publisher` refuses unless
  `.cursor/gate-status.json` shows `"mcp_gate": true` (written by
  `sessionStart`). Missing file means the gate is not active.
- `pr-drafter` has `disallowedTools: terminal`. Never merge.
- `src/observability/before-shell-execution.ts` is defense-in-depth on top of
  that missing capability: it pattern-matches `git merge`, `git rebase`,
  force-push, `git push` to main/master/release, `gh pr merge`, and `gh api`
  merge URLs. It is not a sandbox — indirection (`git $cmd`, aliases) can
  still bypass it. The enforcement boundary is `disallowedTools: terminal`
  on `pr-drafter`.
- Hooks emit to Langfuse when configured; otherwise observability is a no-op
  (see `.env.example`).
- `afterAgentResponse` records native token/cost on the Langfuse generation
  (`usageDetails` + `costDetails`). With `CURSOR_SESSION_TOKEN` it also
  scores `real_conversation_cost_cents` (exact Cursor billing). Expired
  cookie → skip that score; native cost still works.

`config-gates.ts` also keeps every `data/*.json` parseable and whitespace-clean
(LF, one trailing newline, even space indent) so artifacts stay diff-stable.
It checksums `src/validation/` and `src/observability/` against
`data/harness-checksum.json`.

`afterFileEdit` runs on write under `data/*.json`, `src/tests/`, `src/pages/`,
`src/data/`, `src/fixtures/`, `src/validation/`, `src/observability/`, `wiki/`,
`.agents/agents/`, and `.cursor/hooks.json`. It includes
`src/validation/quality-gates.ts` (AC grades, wiki failure-modes, per-test
inversion/tautology/fixture-literal checks) plus the other pipeline
directions. The `stop` hook re-runs `runPipelineGates()` and required judge
verdicts, and writes `out/draft_pr.md` only on PASS. `afterFileEdit` and
`stop` are `failClosed` (non-zero exit on FAIL).
If `review-ui/public/review-data.json` already exists, `afterFileEdit` also
refreshes it so the optional inspector never shows a stale projection; it never
creates that file on its own.

## Layout

- `.agents/agents/` / `.agents/skills/` — tool-agnostic definitions
- `.cursor/hooks.json` / `.cursor/commands/` — Cursor-specific
- Husky `.husky/` — developer git gates, separate from session hooks
- `docs/` — committed human docs (ADR, pipeline diagram)
- `out/` — generated session output (`draft_pr.md`, review-UI build); gitignored
