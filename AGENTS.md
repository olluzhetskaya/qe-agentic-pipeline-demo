# AGENTS.md — Requirement-to-Automation Test Pipeline Demo

This project is the reference implementation for ADR-014
(`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`), built for the
L4 "design a multi-agent QE pipeline" course module.

## Two stages, seven agents

**Stage 0 — manual, requirement to Xray** (`.agents/agents/`):

1. `requirements-analyst` — reads `data/requirement.json` + the wiki,
   produces testable requirement statements.
2. `test-designer` — turns those into test objectives and manual Xray-shaped
   test cases (`data/test-design.json`), applying `.agents/skills/test-case-design`.
3. `xray-publisher` — publishes those cases to Xray via a connected Xray MCP
   server (`create_test_case`, `search_test_cases`). Always proposes the
   exact issue content and waits for confirmation before creating anything —
   see `.cursor/mcp.json.example` for the connection shape.

**Stage 1 — automated, design to code** (`.agents/agents/`):

4. `spec-checker` — reads a ticket + `wiki/business_domain.md`, produces a
   structured spec.
5. `test-generator` — writes the test file, applying the skills in
   `.agents/skills/`.
6. `code-reviewer` — the semantic/judge gate, calibrated against
   `golden_dataset/`.
7. `pr-drafter` — drafts a PR description. Never merges.

Between phases 5 and 6, `.cursor/hooks.json`'s `afterFileEdit` hook runs
automatically — the deterministic gate (ESLint + ast-grep, Sonar in CI)
doesn't wait for an agent to remember to run it. At the end of the session,
the `stop` hook independently re-checks the generated file and writes (or
withholds) `docs/draft_pr.md`.

Not every manual test case gets automated — `data/test-design.json` tracks
`automation_status` per case honestly, including the one that isn't
automated yet.

## Why `.agents/` and not a vendor-specific directory

`.agents/agents/` and `.agents/skills/` follow the shared, tool-agnostic
convention that Cursor, Claude Code, and Codex all discover from — none of
this is locked to one editor. Only `.cursor/hooks.json` stays
vendor-specific, because hook execution doesn't yet have a cross-tool
standard the way agents and skills do.

## Hard boundaries (enforcement, not instruction)

- `xray-publisher` never calls `create_test_case` without proposing the
  content and getting explicit confirmation first.
- No Stage 1 agent has merge tooling. `pr-drafter`'s frontmatter explicitly
  sets `disallowedTools: terminal`.
- `.cursor/hooks/before-shell-execution.cjs` independently blocks any
  `git merge`, `git push ... main/master`, or `gh pr merge` command,
  regardless of which agent tries to run it.
- Every hook logs to `traces/trace.jsonl` — check that file after a session
  for the full reasoning trace, not just the final PASS/FAIL.

## Stack

Playwright + TypeScript. Lint is ESLint bundling `eslint-plugin-playwright`
and `eslint-plugin-sonarjs` (`eslint.config.mjs`); a second, independent
structural check runs via ast-grep (`.ast-grep/`); a live SonarQube/
SonarCloud server config for CI-level tracking lives at
`sonar-project.properties`. **Always assert on a Locator with a web-first
matcher** (`toBeEnabled()`, `toBeVisible()`, `toHaveText()`) — never wrap
element state in a boolean-returning method and assert `.toBe(true)`; see
the note in `src/pages/onboarding-page.ts` and
`golden_dataset/dirty/dirty-03.spec.ts`.

## Business context

Read `wiki/business_domain.md` before generating or reviewing any test that
touches tenant onboarding. It contains the three business rules
(submission gating, tenant isolation, plan tier limits) that the semantic
gate checks against — rules a linter cannot see.
