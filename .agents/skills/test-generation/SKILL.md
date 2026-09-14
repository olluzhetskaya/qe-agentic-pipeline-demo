---
name: test-generation
description: >
  Use when writing a Playwright/TypeScript spec from data/test-design.json
  plus wiki/ (cases already approved, ac_text copied). Stage 1 implementer
  in the main session — not a subagent. After the file lands, invoke
  code-reviewer as an isolated agent.
---

# Skill: Test Generation

## When to use

Only after Stage 0 has a reviewed test-design artifact under `data/`
(objectives + cases), `data/run-state.json` shows `0e_xray_publish: pass`,
and every case to automate has a non-null `xray_key`. A matching
`data/xray-index.json` also requires those keys. Input is
`data/test-design.json` (including each case's `ac_text`) plus `wiki/`.
Do not read `data/requirement.json` or the Jira ticket to rewrite coverage.
The design gate keeps `ac_text` equal to the requirement text.

Automate cases whose `automation_status` is `Not yet automated` and whose
objective candidacy is `Automate`. Skip `Manual-only` / `Defer`. Leave
`Automated` cases alone unless the user asked to regenerate.

Never invent coverage that is not in the test-design artifact. Never point
`automated_by` at `golden_dataset/` — only `src/tests/*.spec.ts`.

## Map Xray cases to code

Each selected case becomes one `test()` (or a `test.step` group inside a
describe). Use the case as written:

| Xray field | In the spec |
|---|---|
| `preconditions` | setup / Given `test.step` |
| `steps[].action` + `data` | When `test.step` |
| `steps[].result` | Then — a web-first assertion (`assertion-author`) |

Cite the linked wiki rule from the objective. Apply `data-layer` **before**
writing the spec: reuse an existing fixture or **create** one under
`src/data/` (and re-export via `src/fixtures/`). Never new string literals
for tenant, plan, or employee IDs.

## Apply these skills in order

0. **data-layer**
1. **explore-browser** — live session; scrape locator candidates and API
   calls into `.agents/artifacts/explore-*.yaml`. Run this before any new
   or repaired POM locator. If the flow is already covered by a current
   Page Object and no locator is missing, skip the walk.
2. **locator-strategy** — rank scraped candidates; never invent a locator
   that the page did not show
3. **pom-builder** — write chosen locators only in `src/pages/`
4. **assertion-author**

## Structure

- `test.describe('Feature name', { tag: [Tags.*] }, () => {...})`
  — `Tags` slices the suite in CI; business-rule traceability stays in
  `data/test-design.json`, not a duplicate tag constant
- Import `Tags` and `testTimeouts` from `@fixtures`
- `test.setTimeout(testTimeouts.standard)` at describe level
- No `try/catch` in spec files

Compare against `golden_dataset/clean/` (shape) and `golden_dataset/dirty/`
(forbidden patterns). Write only under `src/tests/` as `.spec.ts`. A path that
matches a domain in `wiki/sensitive_domains.md` is flagged for manual review by
the hook — surface that in your handoff.

Wait for `afterFileEdit` hook PASS (lint + architecture + quality), then spawn
`code-reviewer` as a **subagent**. Do not semantically review your own spec.
First generate and pass its `REVIEW_CONTEXT` with `npm run verdict:context --
code-reviewer <spec>`. The reviewer writes the verdict artifact. After it
returns, run `npm run verdict:check -- code-reviewer <spec>` and route only
from that exit status. Quality FAIL (wiki inversion, tautology, copied fixture
literals, missing AC grades, missing failure-mode cases) is not a style note
— fix and save again.
