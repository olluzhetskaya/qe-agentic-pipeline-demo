---
name: llm-wiki-ingest
description: >
  Use when a new business rule needs to be added under wiki/ — from a
  requirement, a post-incident review, or a domain change. Always proposes
  the addition and waits for explicit confirmation before writing.
---

# Skill: Wiki Ingest

## Purpose
Keep `wiki/` current as the domain evolves. New rules
discovered during requirement analysis or after a production incident go
through this skill — never directly into the wiki.

## When to use
- Requirement analysis finds a rule implied by a story that isn't in the wiki.
- A production incident reveals a constraint the wiki missed.
- A domain change (new plan tier, new entity) expands the rule set.

## Steps

### 1. Draft the new rule
Follow the wiki's existing format exactly:

```
N. **<Rule title>** (`<kebab-case-slug>`): <one-sentence invariant>.
   <One sentence on what a test violation looks like — "A test that … is
   testing the wrong behavior — flag it.">
   Design: <Technique>, <Technique>
   Failure mode: <phrase> | <phrase>
   Assertion: <locator> <matcher> requires <call>
```

Keep the invariant and failure sentences to two. The lines after them are
structured, not prose — the harness parses them (`src/validation/wiki-rules.ts`)
and holds no rule text of its own:

| Line | Required | What it buys | Enforced by |
|---|---|---|---|
| `Design:` | yes | Techniques Stage 0c must inherit. Allowed: Equivalence Partitioning, Boundary Value Analysis, Decision Table, State Transition, Error Guessing | `design-gates.ts` |
| `Failure mode:` | when the rule has a negative worth designing | A designed case must contain one of the phrases | `quality-gates.ts` |
| `Assertion:` | when a spec can invert the rule | A spec asserting `<matcher>` on `<locator>` without `<call>` fails | `quality-gates.ts` |

Prefer adding a structured line over asking a reviewer to remember the rule:
a line here becomes a deterministic gate, prose becomes a judgment call. If a
new rule needs a whole new kind of check, add the wiki line **and** the parser
support — never a literal in the gate.

Business values and cardinality stay in the rule prose and approved test
design. Do not teach `data-gates.ts` to interpret them: that gate owns only
fixture locations and TypeScript schema/export contracts.

Do not add a test strategy or story test plan to the wiki. Strategy lives in
ADR-014 / the pipeline skills. The per-story plan is `data/test-design.json`.

| Write | Don't write |
|---|---|
| `"Starter tenants may only offer 1 BenefitPlan."` | `"As a Starter admin I want to..."` |
| `"A test asserting multiple plans for Starter is wrong — flag it."` | Background, sprint history, context |

### 2. Propose before writing
Present the draft as a clear proposal in chat:

```
PROPOSED ADDITION to wiki/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ N. **<title>** (`<slug>`): <sentence 1>. <sentence 2>.
+    Design: <Technique>
+    Failure mode: <phrase> | <phrase>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: <Jira key or incident reference>
Gates this enables: <which of design/quality/data gates now cover the rule>
```

Do not write to the file until a human confirms.

### 3. Write and verify
After confirmation: append under `## Business rules`, run `llm-wiki-lint`
to confirm the wiki still passes all checks, then update the test-design
artifact under `data/` with a new test case (or note that the rule is
`Not yet automated`).

## Guardrails

| Never do | Reason |
|---|---|
| Edit the wiki without confirmation | It's the semantic gate's ground truth — silent edits corrupt future reviews |
| Reword or delete existing rules | Breaks traceability to tests calibrated against the old text |
| Add more than one rule per session | Scope creep; one source → one rule |
| Put a rule literal in a gate instead of the wiki | The harness owns *how* to check, the wiki owns *what* — a literal in TypeScript is invisible to the business |
| Leave a new rule with no traceability entry | Every rule needs at least a `Not yet automated` entry in the test-design artifact under `data/` |
