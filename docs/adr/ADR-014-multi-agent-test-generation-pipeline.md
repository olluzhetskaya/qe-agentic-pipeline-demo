# ADR-014: Multi-Agent Test Generation Pipeline — Kelly Benefits Platform 2.0

**Status:** Accepted

## Context

Manual test authoring for new HCM tenant-onboarding flows was the coverage
bottleneck — QC engineers spent ~60% of sprint capacity writing repetitive
Playwright specs instead of exploratory testing. Spec quality was
inconsistent across engineers.

Decision: apply the call/workflow/agent decision tree — this is a
multi-step task with variable input (a ticket + business-domain context) and
no single deterministic transformation, so it qualifies as an **agent**, not
a scripted workflow.

## Decision — Pipeline design

Built entirely on Cursor's native primitives — no custom orchestrator script.
Cursor's own agent is the orchestrator; it delegates to four subagents, in
order, and two hooks fire automatically around them.

| Phase | Component | Location | Output |
|---|---|---|---|
| 1. Context grounding | `@spec-checker` subagent | `.cursor/agents/spec-checker.md` | Structured acceptance criteria + wiki grounding |
| 2. Test generation | `@test-generator` subagent | `.cursor/agents/test-generator.md`, applying `.cursor/skills/{pom-builder,spec-writer,locator-strategy,assertion-author}` | Draft `.py` test file + POM usage |
| 3. Static validation | `afterFileEdit` hook | `.cursor/hooks/after_file_edit.py` (ruff, ast-grep) | PASS/FAIL, blocking, runs automatically on write |
| 4. Semantic validation | `@code-reviewer` subagent | `.cursor/agents/code-reviewer.md` | Judge verdict + findings |
| 5. PR + trace | `@pr-drafter` subagent + `stop` hook | `.cursor/agents/pr-drafter.md`, `.cursor/hooks/stop.py` | Draft PR (`docs/draft_pr.md`) + full trace |

## Validation gates

- **Deterministic gate** (Phase 3, `afterFileEdit` hook): lint (ruff) and
  ast-grep must both pass. Zero-tolerance, blocking, no override —
  classified deterministic because it's a syntactic/structural rule check,
  not a judgment call. Fires automatically the moment a file lands in
  `src/tests/`, so it doesn't depend on a subagent remembering to run it.
- **Judge gate** (Phase 4, `@code-reviewer` + re-checked by the `stop` hook):
  scores the generated test against a clean/dirty golden dataset
  (`golden_dataset/clean/`, `golden_dataset/dirty/`), checking correctness
  and alignment with the business-domain wiki — not "does it compile," but
  "is this testing the right thing." Classified judge because the verdict
  requires quality judgment a static rule can't express. Proven in practice:
  `golden_dataset/dirty/dirty_01.py`'s hardcoded `time.sleep()` passes ruff
  cleanly but fails the semantic check — exactly why both gates exist, not
  just one.

## Human intervention points

- Output is draft-PR-only. `@pr-drafter`'s frontmatter sets
  `disallowedTools: terminal` — the subagent has no shell access, so a
  merge command isn't a capability it has, not just an instruction it's
  told to avoid.
- `.cursor/hooks/before_shell_execution.py` (`beforeShellExecution` hook) is
  a second, independent line of defense: it pattern-matches and blocks
  `git merge`, `git push ... main/master`, and `gh pr merge` for *any*
  agent or subagent that attempts them, regardless of tool configuration.
  This is the advisory-vs-enforcement distinction the L4 course draws —
  one is a missing capability, the other is a runtime block; both are
  present here on purpose.
- Anything touching payroll- or PII-adjacent test paths
  (`src/pages/payroll`, `src/tests/payroll`, `src/tests/pii`) is flagged by
  `after_file_edit.py` for mandatory manual review regardless of gate
  result.

## Observability

Every hook appends to `traces/trace.jsonl` — this stands in for Langfuse
(or any tracing backend) in this demo; swap the `log()` function in
`.cursor/hooks/after_file_edit.py` and `stop.py` for a real Langfuse client
call to wire it up for production. A human can reconstruct exactly what
happened in a session without having watched it live — this is what makes
the L3 course's async review discipline possible applied to a pipeline
instead of a single task.

## Economics

~40 token-equivalent-minutes per generated spec vs. ~35 minutes of manual
authoring. Net positive only after the golden dataset stabilized — the
first two calibration cycles ran at breakeven while `code-reviewer`'s
judgment was being tuned against real dirty examples.

## Consequences

QC engineer time shifts from spec-writing to golden-dataset maintenance,
skill-library upkeep, and gate-failure triage using the trace file. This is
the exact skill set the Validation Engineer Transformation Program's Python
track builds toward.
