---
name: test-case-design
description: >
  Use when turning confirmed test objectives into manual test cases in
  Xray's Action / Data / Expected Result step format. Phase 0c. Distinct
  from test-generation (Playwright spec). Same session as 0a/0b — not
  a subagent. After hook PASS, invoke test-design-reviewer as an isolated agent.
---

# Skill: Test Case Design

## When to use
Phase 0c — after `test-objectives` has produced and confirmed a set of
objectives. Before `xray-publisher` runs. Output is the test-design artifact
under `data/`.

> **Scope:** Functional requirements only. Skip any objective that is
> purely non-functional (performance, accessibility, security posture).

---

## Step 1 — Select test design techniques

Start from the wiki `Design:` line on the linked rule. That is the contract.
You may add a second complementary technique from the table below; you may not
replace the wiki approach with a different family (e.g. EP-only on a
state-transition rule). `design-gates.ts` requires at least one listed
technique to match.

| Technique | Use when |
|---|---|
| **Equivalence Partitioning (EP)** | Input has distinct valid/invalid categories or value ranges |
| **Boundary Value Analysis (BVA)** | Numeric limits, string lengths, count thresholds (e.g. plan tier limit = 1) |
| **Decision Table** | Multiple input conditions that combine to produce different outcomes |
| **State Transition** | Behavior depends on a workflow state (`invited` → `benefits_selected` → `active`) |
| **Error Guessing** | Common failure modes based on domain knowledge (missing plan, wrong tenant) |

Tag each test case with the technique(s) used — this is what `analysis-reporter`
surfaces in the PR summary.

---

## Step 2 — Group objectives into test cases

Do not default to "one objective = one test case." Group first.

### Combine into one positive-flow test case when:
- Objectives form sequential steps of the same user journey (navigate → interact → assert outcome)
- One objective verifies an element is present and the next verifies what happens when it's used
- Objectives trace the same element through a state cycle (e.g. toggle on → toggle off)
- Objectives test the same feature from complementary angles (with/without an option)

### Combine into one negative test case when:
- Objectives test the same user action failing under different invalid inputs
- The failure mechanism belongs to the same error category (validation error, permission denied, etc.)
- They share the same precondition (same page/state before the action)

> **Precondition vs. test data:** Different input values (wrong password vs. empty field)
> are test data variations — not different preconditions. Do not split negatives just because
> the data differs.

### Keep objectives as separate test cases when:
- They have genuinely different entry points or precondition states
- They represent distinct failure categories (network error ≠ validation error)
- Combining them would make the test case non-independently executable

---

## Step 3 — Write each test case

### Title
`Verify <what> when <condition>` — concise and unambiguous.

### Steps — Xray `{ action, data, result }` format
- `action`: imperative verb ("Navigate to…", "Enter…", "Click…", "Verify…") — one clear instruction per step
- `data`: `"-"` when the step has no input, otherwise **one fixture handle**
  from `src/data/` (`Tenants.growth01.defaultPlanLabel`, not `"Dental"` and
  not `"{plan}"`). `design-gates.ts` resolves the handle against the typed
  catalogs — a copied value or a renamed key is FAIL.
- `result`: specific and observable, never vague ("The Finish button is disabled" not "it should work")

For grouped positive flows: one step per objective, with intermediate expected results.
For grouped negatives: one step per invalid-input variation, each with its specific error message.

### Priority

| Priority | Assign when |
|---|---|
| `Critical` | Protects a tenant-isolation rule (multi-tenant regression risk) |
| `High` | Core flow-blocking rule (`submission-gating`, plan-tier limits) |
| `Medium` | Standard functional behavior |
| `Low` | Edge case, rarely triggered |

### Automation candidacy

| Value | Condition |
|---|---|
| `Automated` | A real file under `src/tests/` covers this case exactly |
| `Not yet automated` | Technically automatable but no produced spec exists yet |

Never mark `Automated` because a test *looks similar* — verify the file exists and covers this exact behavior.

---

## Step 4 — Validate coverage

Before writing the test-design artifact under `data/`:

- Every objective has at least one test case (positive or negative)
- Every test case maps to one or more objectives (referenced in the JSON)
- Every case names the acceptance criteria it exercises in `covers_ac`, drawn
  from its objective's `covers_ac`. A case may claim a subset, never more —
  and between them the cases must exercise every criterion the objective
  claims, or the gate reports the criterion the objective promised and no case
  delivered. Do not copy the objective's whole list onto each case
- Steps are independently executable (no hidden dependency on another test case)
- Expected results are specific and measurable (audit: reject any `"should work"`, `"correctly"`, `"as expected"`)
- Test data uses actual values — no placeholders

---

## Output shape

Test-design artifact under `data/` — `test_cases` array. Each entry:

```jsonc
{
  "id": "TC-1",
  "title": "Verify finish button is disabled before benefit plan is selected",
  "linked_objective": "OBJ-1",       // from test-objectives output
  "covers_ac": ["AC-1"],             // subset of that objective's covers_ac
  "ac_text": ["<exact AC-1 text from data/requirement.json>"],
  "requirement_id": "KB-4821",
  "test_type": "Manual",
  "priority": "High",
  "technique": ["State Transition"],
  "automation_status": "Not yet automated",
  "automated_by": null,
  "notes": "No produced spec under src/tests/ yet",
  "xray_key": null,                  // xray-publisher writes this after the catalogue diff; Stage 1 and a matching data/xray-index.json refuse null
  "steps": [
    { "action": "...", "data": "-", "result": "..." }
  ]
}
```

---

## Write, then wait for the hook

Write `test_cases` into the test-design artifact under `data/`. The `afterFileEdit`
hook validates schema **and** quality: placeholders, vague results, broken paths,
coverage, and failure-mode text. The expected phrases are the `Failure mode:`
line of each wiki rule — read them from `wiki/`, do not work from memory.

**Hook PASS** → create `REVIEW_CONTEXT` with `npm run verdict:context --
test-design-reviewer data/test-design.json`, then invoke the reviewer as a
fresh-context subagent. It writes the verdict artifact. Run `npm run
verdict:check -- test-design-reviewer data/test-design.json`; route only from
that exit status. Do not judge your own cases in this conversation.
**Hook FAIL** → fix and save again. Do not invoke the reviewer while FAIL.

## Summary table (present before writing JSON)

Show a summary and wait for go-ahead before writing the test-design artifact under `data/`:

```
| TC ID | Title | Objective(s) | AC | Behavior | Technique | Priority |
|-------|-------|--------------|----|----------|-----------|----------|
| TC-1  | ...   | OBJ-1        | AC-1 | Positive | State Transition | High |
| TC-2  | ...   | OBJ-1        | AC-2 | Negative | EP, Error Guessing | High |
```

---

## Guardrails

| Never do | Reason |
|---|---|
| Skip the grouping step | Produces redundant test cases and inflates Xray |
| Use vague expected results ("should work") | Not executable — a tester can't verify it |
| Use placeholder test data (`{tenantId}`) | Xray imports break; testers can't run the case |
| Mark `Automated` without a `src/tests/` spec | Broken traceability; golden_dataset is calibration |
| Bundle two different failure categories into one negative TC | Fails the single-concern principle |
| Call the Xray MCP server | That is `xray-publisher`'s job, after human review |
