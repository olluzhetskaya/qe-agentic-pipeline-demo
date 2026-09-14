---
name: analysis-reporter
description: >
  Use at the end of a pipeline run to turn gate results (static + semantic)
  into a short, human-readable summary attached to the draft PR.
---

# Skill: Analysis Reporter

## Output shape
A short markdown block with three sections:
1. **Gates passed/failed** — one line per gate (ESLint, ast-grep, Sonar,
   quality, pipeline, semantic review from `data/verdicts/`), pass/fail, with the specific check that failed if any.
2. **Coverage delta** — what business rule(s) this test now covers, referenced
   by name from `wiki/`.
3. **Reviewer note** — one sentence flagging anything a human should look at
   even though gates passed (e.g. "judge-classified criterion, please confirm
   layout").

This is what pr-drafter puts on the draft PR — readable in under 30 seconds,
not a raw log dump.
