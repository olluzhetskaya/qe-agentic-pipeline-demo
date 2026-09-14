---
name: requirements-analysis
description: >
  Use when turning a raw Jira Story into a set of testable requirement
  statements grounded in the business-domain wiki. Phase 0a — runs in the
  main session before test-objectives and test-case-design, never after.
  Not a subagent: statements must stay in this conversation for 0b.
---

# Skill: Requirements Analysis

## When to use
Phase 0a — before test-objectives, test-case-design, or any code is written.
Input is a Jira Story key (e.g. `KB-4821`), fetched live via the Atlassian
CLI. Output is a quality-graded list of testable requirement statements plus
any clarification questions that must be answered before test design starts.

> **Scope:** Functional requirements only. Non-functional requirements
> (performance, accessibility, security posture, compliance) are out of scope.
> Skip any AC that is purely non-functional — do not evaluate, gap-check, or
> question it.

---

## Step 0 — Fetch the requirement from Jira

```bash
acli jira workitem view KB-4821 --json \
  --fields 'summary,description,comment,issuetype,status,priority,labels,*navigable'
```

Parse the response. Fields you need:

| JSON path | Maps to |
|---|---|
| `.fields.summary` | Story title |
| `.fields.description` | Acceptance criteria / description (ADF or plain) |
| `.fields.comment.comments[*].body` | Raw notes and thread context |
| `.fields.labels` | May imply a business rule class |

If `acli` is not authenticated, stop:
```
acli jira auth   # browser login
```
Do not silently fall back to the requirement cache under `data/` — if the live fetch
fails, say so and ask whether to proceed from the cached file.

Cache parsed fields under `data/` after a successful fetch. Persist quality
on every AC: `type` (`deterministic` | `judge`) and `grade` (`PASS` | `FAIL` |
`SKIP`) plus an integer `confidence` from 0–100. Also persist
`analysis_confidence: { score, threshold: 75, threshold_basis: "policy", rationale }`
and `analysis_decision: { status, reason, escalate }`. `threshold_basis` is
policy, not a measured calibration. Judge/NFR ACs are `SKIP`.

## Evidence, nulls, and confidence

- Never infer a missing Jira value from conventions, comments, the wiki, or
  another ticket. Preserve an unavailable source value as JSON `null`.
- Do not use `"unknown"`, `"N/A"`, `"TBD"`, an empty string, or a plausible
  invented value in place of `null`.
- A confidence score measures support for the analysis, not requirement
  quality. A clear but defective AC can be `FAIL` with high confidence.
- Score each AC and the overall handoff from 0–100:
  - `90–100`: directly supported by explicit Jira text and a matching wiki rule.
  - `75–89`: supported, with a minor interpretation stated in the rationale.
  - `<75`: material ambiguity or missing evidence. Persist
    `analysis_decision.status: "WAITING"` with a non-empty `reason` and
    `escalate` array. Never `AUTO_PROCEED`.
- Confidence never overrides a FAIL, ambiguity, or human gate.

---

## Step 1 — Evaluate quality of each acceptance criterion

For every **functional** AC in the story, assess against:

| Dimension | Question |
|---|---|
| **Testable** | Can a test be designed to verify this? |
| **Unambiguous** | Is there only one valid interpretation? |
| **Complete** | Does it have enough detail (Given/When/Then or equivalent)? |
| **Measurable** | Does it specify a concrete, observable expected outcome? |
| **Consistent** | Does it contradict any other AC in this story? |

If any AC fails a check, mark it `FAIL`, state why, and **stop — do not
proceed with test objectives until the failure is resolved or clarified**.
Incorporate user answers and re-evaluate.

---

## Step 2 — Coverage and gap analysis

### A. Coverage completeness
Check whether the story and ACs collectively address:
- All mentioned UI elements fully specified?
- Constraints defined (format, size, limits, allowed values)?
- All user flows covered (happy path + alternatives)?

### B. Field-level validation completeness
For every input field described in the story, verify whether these are defined:

| Property | Defined? |
|---|---|
| Required / optional | |
| Validation rules | |
| Format constraints | |
| Length constraints | |
| Allowed values | |
| Error behavior | |

Report each gap explicitly:
> **Requirement Gap:** `[field]` — `[missing property]`

### C. Negative and edge scenarios
Check whether the story covers:
- Invalid input behavior
- Duplicate submission handling
- Boundary conditions (e.g. plan count at tier limit)

---

## Step 3 — Ground in the wiki

Use `llm-wiki-query` to look up each behavior against `wiki/`.

| Situation | Action |
|---|---|
| Behavior maps to an existing rule | Tag the statement: `[submission-gating]` |
| Behavior implies a new rule | Use `llm-wiki-ingest` to propose the addition; flag as `[NEW-RULE: proposed]` |
| Requirement contradicts the wiki | **Stop.** Flag and ask — do not pick an interpretation |

---

## Step 4 — Produce testable requirement statements

One statement per verifiable behavior, written only for ACs that passed
Step 1. Format:

```
[RULE-TAG] <Actor> <observable outcome> <when/given condition>.
```

---

## Step 5 — Generate clarification questions

List questions a QA engineer would ask the BA before test design starts.
Only for functional gaps found in Steps 1–2. Do not include NFR questions.

---

## Deterministic self-check (before presenting)

| Check | Pass condition |
|---|---|
| Every AC evaluated | All functional ACs have a quality grade (PASS/FAIL) |
| Confidence recorded | Every AC and the overall handoff have integer 0–100 scores |
| Missing values are null | Unavailable Jira source fields are JSON `null`, never guessed |
| All statements tagged | Every testable statement has a `[rule-tag]` or `[NEW-RULE: proposed]` |
| No plain statements | No statement without a tag; tagging forces wiki grounding |
| Wiki lint | Run `llm-wiki-lint` — result must be LINT PASS |

## Conditional human gate

Persist `analysis_decision` on `data/requirement.json`. Chat text is not
the control input.

**`status: "AUTO_PROCEED"`** when all of the following are true:
- All deterministic AC grades are PASS
- Judge/NFR ACs are SKIP
- No `[NEW-RULE: proposed]` tags
- No ambiguity flags
- Wiki lint returns LINT PASS
- `npm run gate:quality` would PASS on the cache
- Overall handoff confidence is at least the policy threshold (75)
- `reason` and `escalate` are JSON `null`

**`status: "WAITING"`** when any AC is FAIL, a new rule is proposed, or
ambiguity is flagged. `reason` must be a non-empty string. `escalate` must
be a non-empty string array. Set `data/run-state.json` `0a_requirements` to
`waiting`. Do not start test-objectives.

## Output format

```
## Acceptance Criteria Quality

- AC1 — [title]: PASS — confidence 96/100
- AC2 — [title]: FAIL — confidence 99/100 — not testable: expected outcome is not observable

## Coverage & Gaps

Coverage completeness: PASS / PARTIAL / FAIL
- [finding]

Field-level validation gaps:
- Requirement Gap: [field] — [missing property]

Negative & edge scenario coverage: PASS / PARTIAL / FAIL
- [finding]

## Wiki grounding

- [RULE-TAG] [statement]
- [NEW-RULE: proposed] [statement] — awaiting wiki confirmation

## Requirement-analysis handoff

- Confidence: NN/100
- Rationale: [evidence supporting the score]
- Unknown source values: [`field: null` entries, or an empty list]

## Clarification questions
1. [question]
2. [question]
```

---

## Guardrails

| Never do | Reason |
|---|---|
| Skip the acli fetch | The requirement cache under `data/` may be stale |
| Continue past a FAIL in Step 1 | An unresolvable AC produces an untestable or wrong test case |
| Invent a business rule not in the wiki | Tag or propose — never assume |
| Invent a missing source value | Store JSON `null` and name it in the handoff |
| Report confidence without rationale | The score must be auditable, not decorative |
| Write to any file other than the requirement cache under `data/` | Analysis stays in chat; wiki additions require confirmation |
| Produce Given/When/Then or test steps | Steps are `test-case-design`; code is `test-generation` |
| Evaluate non-functional ACs | Out of scope — skip them entirely |
