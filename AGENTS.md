# AGENTS.md — QE Agentic Pipeline Demo

This project is the reference implementation for ADR-014
(`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`), built for the
L4 "design a multi-agent QE pipeline" course module.

## How the pipeline runs in Cursor

There is no orchestrator script — Cursor's own agent is the orchestrator.
It delegates to four subagents in `.cursor/agents/`, in this order:

1. `@spec-checker` — reads a ticket + `wiki/business_domain.md`, produces a
   structured spec.
2. `@test-generator` — writes the test file, applying the skills in
   `.cursor/skills/`.
3. `@code-reviewer` — the semantic/judge gate, calibrated against
   `golden_dataset/`.
4. `@pr-drafter` — drafts a PR description. Never merges.

Between phases 2 and 3, `.cursor/hooks.json`'s `afterFileEdit` hook runs
automatically — the deterministic gate (lint + ast-grep) doesn't wait for a
subagent to remember to run it.

At the end of the session, the `stop` hook independently re-checks the
generated file against the same seeded patterns and writes (or withholds)
`docs/draft_pr.md`.

## Hard boundaries (enforcement, not instruction)

- No subagent has merge tooling. `pr-drafter`'s frontmatter explicitly sets
  `disallowedTools: terminal`.
- `.cursor/hooks/before_shell_execution.py` independently blocks any
  `git merge`, `git push ... main/master`, or `gh pr merge` command,
  regardless of which subagent — or the main agent — tries to run it.
- Every hook logs to `traces/trace.jsonl` — check that file after a session
  for the full reasoning trace, not just the final PASS/FAIL.

## Business context

Read `wiki/business_domain.md` before generating or reviewing any test that
touches tenant onboarding. It contains the three business rules
(submission gating, tenant isolation, plan tier limits) that the semantic
gate checks against — rules a linter cannot see.
