# Requirement-to-Automation Test Pipeline — L4 Lab Demo

A small, real example of the pipeline described in
[`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`](docs/adr/ADR-014-multi-agent-test-generation-pipeline.md) —
built with Playwright + TypeScript, tool-agnostic agent/skill definitions,
and Cursor's real hook mechanism. Covers **both** halves of the L4
accelerator story: the manual requirement-analysis/test-design/Xray-publish
work, and the automated test-generation pipeline that follows it.

Built for the L4 "design a multi-agent QE pipeline" module, in response to
learner feedback that the module gave a task description ("build an ADR")
with nothing to start from. This repo is that starting point.

## Two stages

**Stage 0 — manual: requirement → test design → Xray**, three agents:
`requirements-analyst` reads a raw requirement and the wiki; `test-designer`
turns that into test objectives and Xray-shaped manual test cases
(`data/test-design.json`); `xray-publisher` proposes and, on confirmation,
publishes those cases to Xray via a connected Xray MCP server.

**Stage 1 — automated: design → code**, four agents plus two hooks:
`spec-checker` → `test-generator` → (`afterFileEdit` hook) → `code-reviewer`
→ `pr-drafter` → (`stop` hook). Not every manual test case gets automated —
`data/test-design.json` tracks this honestly, including the one case that
doesn't have automation yet.

## What's here

| Component | Location | What it is |
|---|---|---|
| Raw requirement | `data/requirement.json` | Stage 0 input — a Story, not yet acceptance criteria |
| Test design | `data/test-design.json` | Stage 0 output — objectives + Xray-shaped manual test cases, with honest automation-coverage tracking |
| Business-domain wiki | `wiki/business_domain.md` | Grounding context every agent reads before generating or reviewing a test |
| Skills | `.agents/skills/{pom-builder,spec-writer,locator-strategy,assertion-author,analysis-reporter,test-case-design}/SKILL.md` | Tool-agnostic Agent Skills — same location convention Cursor, Claude Code, and Codex all read |
| Agents | `.agents/agents/{requirements-analyst,test-designer,xray-publisher,spec-checker,test-generator,code-reviewer,pr-drafter}.md` | Tool-agnostic agent definitions across both stages |
| Xray MCP connection | `.cursor/mcp.json.example` | Template for connecting a real Xray MCP server (several community servers exist; no single official Atlassian one) |
| Hooks | `.cursor/hooks.json` + `.cursor/hooks/*.cjs` | Real Cursor hooks — `beforeShellExecution`, `afterFileEdit`, `stop`, per [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks). Stage 1 only; Stage 0's confirmation gate lives in the `xray-publisher` agent's own instructions instead. |
| POM | `src/pages/` | Real Playwright TypeScript Page Objects — locators exposed publicly for web-first assertions, see note below |
| Golden dataset | `golden_dataset/{clean,dirty}/` | Real `.spec.ts` calibration files the judge gate and the `stop` hook both check against |
| Lint | `eslint.config.mjs` | ESLint bundling `eslint-plugin-playwright` + `eslint-plugin-sonarjs`, scoped to `*.spec.ts` |
| Second static check | `.ast-grep/` | Two independent structural rules, deliberately overlapping with ESLint |
| Sonar (CI) | `sonar-project.properties` | Server-side SonarQube/SonarCloud config for cross-run tracking |
| ADR | `docs/adr/ADR-014-*.md` | The actual deliverable format the L4 module asks for |

## A real mistake this repo caught in itself

An earlier draft of `OnboardingPage` wrapped element state in an
`isFinishEnabled(): Promise<boolean>` method, and every test asserted
`expect(await onboarding.isFinishEnabled()).toBe(false)`. That's the exact
anti-pattern Playwright's own docs warn against — use **web-first
assertions** (`toBeVisible()`, `toBeEnabled()`, `toHaveText()`) directly on
a `Locator`, which auto-retry, instead of snapshotting a boolean once.

Testing it against the real, installed `eslint-plugin-playwright` surfaced
something sharper than a style complaint: `playwright/prefer-web-first-assertions`
**did not fire on the wrapped version**. The rule only matches a raw
Playwright locator method (`.isEnabled()`, `.isVisible()`, etc.) called
directly — hide that call one level behind your own method name and the
linter can't see it at all. `src/pages/onboarding-page.ts` now exposes
`finishButton` as a public `Locator`; `golden_dataset/dirty/dirty-03.spec.ts`
calibrates the broken shape on purpose, with a raw `.isEnabled()` call
right there in the test, so the gate has something real to catch.

## Setup

```bash
npm install
```

Installs Playwright, TypeScript, ESLint + `eslint-plugin-playwright` +
`eslint-plugin-sonarjs`, and `@ast-grep/cli` as real dependencies. Does
**not** download Playwright's browser binaries (this demo never launches a
real browser; it only lints and typechecks).

## Run it

```bash
npm run lint          # ESLint (src + .cursor), including playwright + sonarjs rules
npx tsc --noEmit       # typecheck
npx ast-grep scan --config .ast-grep/sgconfig.yml src/tests
```

`npm run lint` targets `src` and `.cursor` explicitly, not the whole repo —
`golden_dataset/` is excluded from that default sweep on purpose (see the
dry-run section below), the way a real CI gate never lints known-bad
fixtures as if they were shipped code. Point ESLint at those files directly
and the rules still apply in full.

There is no orchestrator script for either stage — a live agent session
(Cursor, or another `.agents/`-compatible runtime) is the orchestrator.
Stage 0 needs an Xray MCP server connected to do anything beyond drafting;
Stage 1's hooks only fire inside a live Cursor session.

### Dry-running the Stage 1 hooks outside a live agent session

The three hook scripts are plain Node.js that reads JSON from stdin and
writes JSON to stdout — you can exercise their real logic directly:

```bash
# enforcement: allowed vs. blocked shell commands
echo '{"command": "npx playwright test"}' | node .cursor/hooks/before-shell-execution.cjs
echo '{"command": "git merge feature/onboarding"}' | node .cursor/hooks/before-shell-execution.cjs

# deterministic gate: point it at a clean vs. dirty file
cp golden_dataset/clean/clean-01.spec.ts src/tests/tenant-onboarding-generated.spec.ts
echo '{"file_path": "src/tests/tenant-onboarding-generated.spec.ts"}' | node .cursor/hooks/after-file-edit.cjs

# session-end semantic re-check + draft PR gating
echo '{"conversation_id": "demo"}' | node .cursor/hooks/stop.cjs
cat docs/draft_pr.md   # only exists if the semantic gate passed
```

The golden dataset has three dirty variants, each demonstrating a different
gap:

- `dirty-01.spec.ts` (hardcoded wait) — caught **three** independent ways:
  `playwright/no-wait-for-timeout`, `sonarjs/no-fixed-wait-in-tests`, and
  the ast-grep rule all fire on the same line.
- `dirty-02.spec.ts` (business-rule inversion) — uses a syntactically
  **perfect** web-first assertion, asserted at the wrong point in the flow.
  Passes ESLint, sonarjs, and ast-grep cleanly. Only `stop.cjs`'s semantic
  re-check (or a real `code-reviewer` session reading the wiki) catches it.
- `dirty-03.spec.ts` (raw locator + boolean assertion) — caught by
  `playwright/prefer-web-first-assertions` and, as a coarser backup, the
  `no-boolean-literal-assertion` ast-grep rule. Also silently bypasses the
  POM in a way no lint rule flags — see the comment in that file for why.

Every hook run appends to `traces/trace.jsonl`.

## What's real vs. what's a stand-in

| Piece | Real | Stand-in here |
|---|---|---|
| Wiki, skills, POM, golden dataset, test-design data | ✅ | — |
| Agent definitions | ✅ tool-agnostic `.md` format | The *content* they'd generate is only produced when a live agent runtime actually runs them |
| Xray publishing | ✅ real MCP tool names/shapes (`create_test_case`, `search_test_cases`), verified against actual Xray MCP server docs | No live Xray/Jira project connected in this demo — `xray-publisher` can't do anything beyond drafting without one |
| Hooks | ✅ real Cursor hook events, real payload/response shape, verified by piping real JSON through them | — |
| ESLint + eslint-plugin-playwright + eslint-plugin-sonarjs | ✅ installed and run for real, 279 sonarjs rules active | — |
| ast-grep | ✅ installed and run for real | — |
| SonarQube (server) | Config is real and CI-ready | No live server in this demo — but the rule-level checking is real, via eslint-plugin-sonarjs |
| Semantic gate (Stage 1) | Real gate *structure*, calibrated against a real golden dataset | The judgment itself is a keyword/precondition check standing in for `code-reviewer`'s actual LLM reasoning |
| Draft PR | ✅ enforced draft-only, for real (no `merge()` capability, no `terminal` tool, plus a shell-level block) | The PR itself is a local markdown file, not a real GitHub PR |

## Map back to the L4 course

- **Requirement analysis, test objectives, test design** → Stage 0's three
  agents, `data/requirement.json` → `data/test-design.json`.
- **Decision tree** → "Context" in the ADR: why requirement/design work and
  code generation are treated as different kinds of task.
- **Quality gates, deterministic vs. judge** → `afterFileEdit` hook
  (ESLint + ast-grep, Sonar in CI) vs. `code-reviewer` + `stop` hook,
  calibrated against `golden_dataset/`.
- **Reusable agent skills, published to AI Hub** → `.agents/skills/*/SKILL.md`.
- **ADR** → `docs/adr/ADR-014-*.md`.
- **Harness / enforcement vs. advisory** → `pr-drafter`'s
  `disallowedTools: terminal` plus `before-shell-execution.cjs`; on the
  manual side, `xray-publisher`'s propose-then-confirm requirement before
  any Jira write.
- **Observability / feedback controls** → `traces/trace.jsonl`; on the
  manual side, `data/test-design.json`'s own `automated_by` links.
- **Economics** → "Economics" section in the ADR.

## What's intentionally small

One page object, one requirement, four manual test cases (three automated,
one not), three hooks. Extend it the same way you'd extend a real pipeline:
more agents, a bigger golden dataset, a real Xray MCP connection, a real
Langfuse client swapped into the `log()` calls.
