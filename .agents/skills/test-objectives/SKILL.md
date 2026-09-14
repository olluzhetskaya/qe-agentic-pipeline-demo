---
name: test-objectives
description: >
  Use when grouping requirements-analysis testable statements into test
  objectives — one level above individual test cases. Phase 0b. Always
  runs before test-case-design (Phase 0c), never instead of it. Same
  session as 0a — not a subagent. Always stop for human go-ahead.
---

# Skill: Test Objectives

## When to use
Phase 0b — after `data/requirement.json` has
`analysis_decision.status: "AUTO_PROCEED"` and `npm run gate:quality` PASS.
Do not start if status is `WAITING`. Before test-case-design writes any
Xray steps.

## What a test objective is
A test objective answers the question: *"What capability or behavior are we
verifying, at the level a stakeholder can understand without knowing the
test steps?"*

It is **not** a test case. It has no steps, no data rows, no expected
results. It exists to make the coverage intent explicit and reviewable before
the cost of writing steps is incurred.

## Rules

### 1. One objective per distinct behavior boundary
Group related statements under one objective only if they test the same
observable state change. If two statements require different preconditions
or different actors, they belong in separate objectives.

```
Good:  "Submission gating — Finish button disabled until benefits selected"
Bad:   "Submission gating and plan-tier limits" (two behaviors, one objective)
```

### 2. Name it from the user's perspective, not the test's
```
Good:  "Employee cannot complete onboarding without a benefit plan"
Bad:   "Test that finishButton.isDisabled() returns true"
```

### 3. Tag each objective to a requirement statement
Every objective must cite the requirement ID it traces to
(e.g. `requirement_id: "KB-4821"`) and the wiki rule tag from the
requirements-analysis output (e.g. `[submission-gating]`). No objective
without a traceable source.

The `wiki_rule` must be one of the `wiki_refs` the requirement artifact
declares. A rule that exists in `wiki/` but not in this story's refs is
domain knowledge the test must *respect* (which fixture tier to pick, which
precondition an assertion needs) — it is not something this story must
*verify*. Never add an objective just because a wiki rule is unclaimed.

Name the acceptance criteria too, in `covers_ac`. Only criteria the
requirement artifact typed as automation candidates may be listed — a
judge/NFR criterion is not covered by an objective, and claiming it is a
design-gate finding. Every automatable criterion must appear in at least one
objective's `covers_ac`, or the gate reports the coverage hole.

`covers_ac: []` is allowed only with `notes` explaining why an objective
exists that verifies no criterion. Prefer flagging a missing criterion to the
human over quietly adding scope (see rule 5).

### 4. Identify automation candidacy now, not later
For each objective, state whether it is a candidate for automation,
and why. Use these categories:

| Category | Criteria |
|---|---|
| `Automate` | Deterministic, repeatable, no human judgment in pass/fail |
| `Manual-only` | Requires exploratory judgment, visual QA, or non-deterministic state |
| `Defer` | Technically automatable but too expensive relative to risk right now |

This does not commit to automation — `test-case-design` will verify whether a
file already exists in `src/tests/` before writing `automation_status`.

### 5. Don't exceed the requirement's scope
If the requirement does not mention tenant isolation, do not add an
isolation objective just because you know it exists. The wiki grounds
*existing* rules; it doesn't authorize scope expansion. Flag if you think
coverage is missing, but don't silently add objectives the story doesn't
support. Coverage is measured against the story's acceptance criteria, never
against the size of `wiki/`.

## Output shape

```jsonc
// one element per objective, written into the test-design artifact
// under data/ (test_objectives array)
{
  "id": "OBJ-1",
  "name": "Employee cannot complete onboarding without selecting a BenefitPlan",
  "requirement_id": "KB-4821",
  "covers_ac": ["AC-1", "AC-2"],
  "wiki_rule": "submission-gating",
  "automation_candidacy": "Automate",
  "notes": ""
}
```

## Deterministic self-check (before presenting to human)

```
✓ id          — present, unique, format OBJ-N
✓ name        — non-empty, user-perspective phrasing
✓ requirement_id — matches the Jira key in the requirement cache under data/
✓ covers_ac   — every id exists in data/requirement.json and is an automation
                candidate; [] only with notes explaining the wiki-rule origin
✓ wiki_rule   — slug is one of the requirement artifact's wiki_refs
✓ automation_candidacy — one of: Automate | Manual-only | Defer
```

Do not present broken entries.

## Human gate (always)

**Always stop here.** Present the validated objectives table, then:

`Awaiting go-ahead. Reply to proceed to test-case-design.`

Wrong objectives mean all test-case steps and grouping must be redone.

## Guardrails

| Never do | Reason |
|---|---|
| Write test steps at this stage | Steps belong in test-case-design (Phase 0c), not here |
| Create an objective with no `requirement_id` | Orphaned objectives become orphaned tests — no traceability |
| Pad `covers_ac` with a criterion the objective doesn't verify | Fake coverage is worse than a reported hole |
| Mark `automation_candidacy: "Automate"` without checking `src/tests/` | test-case-design will verify; do not set false expectations here |
| Merge objectives that cover different wiki rules | One objective → one rule → one traceable chain |
| Produce more objectives than there are distinct behaviors | Coverage breadth is not a quality metric here; precision is |
