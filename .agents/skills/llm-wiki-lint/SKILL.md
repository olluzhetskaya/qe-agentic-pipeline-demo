---
name: llm-wiki-lint
description: >
  Use to validate wiki/ — checks format, slug consistency, coverage
  traceability, and entity completeness. Run after llm-wiki-ingest or
  before starting a new pipeline session.
---

# Skill: Wiki Lint

## Purpose
The wiki is only useful as agent ground truth if it stays well-formed.
This skill catches format drift, orphaned rule slugs, and broken
`automated_by` links before they silently corrupt pipeline output.

## When to run
- After `llm-wiki-ingest` adds a new rule.
- Before `requirements-analysis` starts a fresh pipeline session.
- When `code-reviewer` reports a finding it couldn't trace to a named rule.

## Checks

### Check 1 — Rule format
Every entry under `## Business rules` must be:
```
N. **<rule title>** (`<kebab-case-slug>`): <rule and test guidance>.
   Design: <Technique>[, <Technique>]
   Failure mode: <phrase>[ | <phrase>]          # optional
   Assertion: <locator> <matcher> requires <call>   # optional
```
The structured lines are what the harness executes — `src/validation/wiki-rules.ts`
is the only parser, so a malformed line disables a gate rather than half-running it.
Flag any rule that:
- Has no bold title, or a slug with spaces/underscores
- Exceeds 3 sentences of prose (structured lines are not counted as prose)
- Has no failure-detection guidance ("A test that … flag it")
- Has no `Design:` line, or lists a technique outside Equivalence Partitioning,
  Boundary Value Analysis, Decision Table, State Transition, Error Guessing
- Declares a `Failure mode:` or `Assertion:` line that does not match
  the grammar above (the gate reports it as a wiki finding, not a test failure)

### Check 1b — Sensitive domains
`wiki/sensitive_domains.md` uses the same numbered `(slug)` grammar under
`## Sensitive domains`. `afterFileEdit` reads those slugs to decide when to
demand manual review, so an empty or malformed section silently disables the
flag. At least one domain must be declared.

### Check 2 — Slug consistency
Every `wiki_refs` entry in `data/requirement.json` must name a declared rule
in `wiki/`, and every objective's `wiki_rule` must be one of that story's
`wiki_refs`. `src/validation/design-gates.ts` enforces this; do not recreate
it with an ad-hoc grep.

### Check 3 — Coverage traceability
Report which declared rules no current test-design case exercises, and note
whether each linked case is `Automated` with a real file or `Not yet
automated` with a note.

This is an observation about the rule portfolio, not a defect in the story in
`data/`. One story covers the criteria *it* states; a rule left uncovered
means some future story owes it a criterion. Never turn this into a demand
that the open test design add an objective per wiki rule.

Check for broken `automated_by` paths against the test-design artifact in
`data/` (resolve each path from the repo root). `automated_by` must be
`null` or a file under `src/tests/`; `golden_dataset/` is calibration.

### Check 4 — Entity completeness
Each entity in `## Core entities` needs: bold name, at least one typed
property, and a stated relationship to another entity (or a note that it
stands alone).

## Output
```
wiki/ lint result
────────────────────────────────────
Check 1 Rule format        PASS
Check 1b Sensitive domains PASS
Check 2 Slug consistency   FAIL  orphaned: [new-slug] not in wiki
Check 3 Coverage           PASS
Check 4 Entity completeness PASS
────────────────────────────────────
LINT FAIL — 1 issue
```

Only a **LINT PASS** means the wiki/design relationship is safe to use.
Executable format, slug, coverage, and `automated_by` findings block
`npm run gate:pipeline`; semantic entity-quality findings remain advisory.
