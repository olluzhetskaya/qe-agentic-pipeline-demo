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

| Phase | Component | Tool & skill access | Output |
|---|---|---|---|
| 1. Context grounding | `spec_checker` agent | Ticket data, business-domain wiki | Structured acceptance criteria + wiki grounding |
| 2. Test generation | `test_generator` agent | Skills: pom_builder, spec_writer, locator_strategy, assertion_author | Draft `.py` test file + POM usage |
| 3. Static validation | `static_checks` gate | ruff (lint), ast-grep, Sonar | PASS/FAIL, blocking |
| 4. Semantic validation | `code_reviewer` agent | Generated diff + wiki context + golden dataset | Judge verdict + findings |
| 5. PR + trace | `pr_agent` | Local FS (draft only — no merge capability), trace hook | Draft PR + full execution trace |

## Validation gates

- **Deterministic gate** (Phase 3): lint, ast-grep, and Sonar must all pass.
  Zero-tolerance, blocking, no override — classified deterministic because
  it's a syntactic/structural rule check, not a judgment call.
- **Judge gate** (Phase 4): scores the generated test against a clean/dirty
  golden dataset (`golden_dataset/clean/`, `golden_dataset/dirty/`),
  checking correctness and alignment with the business-domain wiki — not
  "does it compile," but "is this testing the right thing." Classified
  judge because the verdict requires quality judgment a static rule can't
  express (see `golden_dataset/dirty/dirty_02.py` — syntactically perfect,
  semantically inverts a business rule).

## Human intervention points

- Output is draft-PR-only. `pr_agent.py` has no `merge()` method at all —
  the boundary is the absence of a capability, not a written instruction.
  `pipeline/hooks/enforcement.py` adds an explicit check on top as a second
  line of defense.
- Anything touching payroll- or PII-adjacent test paths routes to mandatory
  manual review regardless of gate result (`enforce_pii_path_review`).

## Observability

Every phase and every hook logs to `traces/trace.jsonl` (stands in for
Langfuse in this demo — see `pipeline/hooks/trace_hook.py`). A human can
reconstruct exactly what happened in a run without having watched it live —
this is what makes Phase 4's async review discipline possible at all.

## Economics

~40 token-equivalent-minutes per generated spec vs. ~35 minutes of manual
authoring. Net positive only after the golden dataset stabilized — the
first two calibration cycles ran at breakeven while `code_reviewer`'s
pattern set was being tuned against real dirty examples.

## Consequences

QC engineer time shifts from spec-writing to golden-dataset maintenance,
skill-library upkeep, and gate-failure triage using the trace file. This is
the exact skill set the Validation Engineer Transformation Program's Python
track builds toward.
