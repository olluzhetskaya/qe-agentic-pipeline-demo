# AGENTS.md — QE Agentic Pipeline Demo

This project is the reference implementation for ADR-014
(`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`), built for the
L4 "design a multi-agent QE pipeline" course module.

## How the pipeline runs

There is no orchestrator script — the main agent is the orchestrator. It
delegates to four agents in `.agents/agents/`, in this order:

1. `spec-checker` — reads a ticket + `wiki/business_domain.md`, produces a
   structured spec.
2. `test-generator` — writes the test file, applying the skills in
   `.agents/skills/`.
3. `code-reviewer` — the semantic/judge gate, calibrated against
   `golden_dataset/`.
4. `pr-drafter` — drafts a PR description. Never merges.

Between phases 2 and 3, `.cursor/hooks.json`'s `afterFileEdit` hook runs
automatically — the deterministic gate (ESLint + ast-grep, Sonar in CI)
doesn't wait for an agent to remember to run it.

At the end of the session, the `stop` hook independently re-checks the
generated file against the same seeded patterns and writes (or withholds)
`docs/draft_pr.md`.

## Why `.agents/` and not a vendor-specific directory

`.agents/agents/` and `.agents/skills/` follow the shared, tool-agnostic
convention that Cursor, Claude Code, and Codex all discover from — none of
this is locked to one editor. Only `.cursor/hooks.json` stays
vendor-specific, because hook execution doesn't yet have a cross-tool
standard the way agents and skills do. If you're working in a different
agent runtime, the agent/skill definitions still apply as-is; you'd only
need to reimplement the three hook scripts' logic in that runtime's hook
mechanism, if it has one.

## Hard boundaries (enforcement, not instruction)

- No agent has merge tooling. `pr-drafter`'s frontmatter explicitly sets
  `disallowedTools: terminal`.
- `.cursor/hooks/before-shell-execution.cjs` independently blocks any
  `git merge`, `git push ... main/master`, or `gh pr merge` command,
  regardless of which agent tries to run it.
- Every hook logs to `traces/trace.jsonl` — check that file after a session
  for the full reasoning trace, not just the final PASS/FAIL.

## Stack

Playwright + TypeScript. Lint is ESLint bundling `eslint-plugin-playwright`
and `eslint-plugin-sonarjs` (Sonar's real rule set, running locally, no
server) in `eslint.config.mjs`; a second, independent structural check runs
via ast-grep (`.ast-grep/`); a live SonarQube/SonarCloud server config for
CI-level tracking lives at `sonar-project.properties`.

## Business context

Read `wiki/business_domain.md` before generating or reviewing any test that
touches tenant onboarding. It contains the three business rules
(submission gating, tenant isolation, plan tier limits) that the semantic
gate checks against — rules a linter cannot see.
