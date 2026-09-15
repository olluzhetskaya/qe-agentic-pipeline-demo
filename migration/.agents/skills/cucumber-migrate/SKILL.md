---
name: cucumber-migrate
description: >
  Use when writing a Playwright/TypeScript spec from
  data/mapping.json (cases already approved). Stage 1
  implementer in the main session — not a subagent. After the file lands,
  invoke migration-code-reviewer as an isolated agent.
---

# Skill: Cucumber Migrate

## When to use

Only after Stage 0 has a reviewed mapping, and
`data/run-state.json` shows `0d_mapping_review: pass`.
Input is `data/mapping.json` plus `data/inventory.json`.
Do not read `data/requirement.json` or rewrite Gherkin as a new story.

Migrate cases whose `decision` is `Automate` **and** whose `batch_id`
equals `run-state.batch.id`. Skip other batches. Skip `Manual-only`,
`Defer`, and `Drop`. Never invent a scenario that is not in the mapping.
After the spec exists, set those rows to `automation_status: "Automated"`.
Do not delete specs from earlier batches.

Write specs only under `tests/` as `.spec.ts`. Never write under
another project. Set `stage` to `1a_generation` before the first
current-batch spec write.

## Map mapping rows to code

Each selected case becomes one `test()` (or a `test.step` group).

| Mapping field | In the spec |
|---|---|
| Given / Background | setup `test.step` |
| When | When `test.step` |
| `steps[].result` | Then — a web-first assertion (`assertion-author`) |

Every Then in the mapping must appear as an assertion. Dropping a Then is
a FAIL for `migration-code-reviewer`.

## Apply these skills in order

0. **data-layer** — create missing fixtures under `src/data/`, export via
   `@fixtures`. Do not hard-code IDs in the spec.
1. **explore-browser** — live scrape into `.agents/artifacts/explore-*.yaml`
   when the SUT UI is reachable.
2. If the session cannot open, apply **legacy-locator-harvest**
   (`.agents/skills/legacy-locator-harvest/SKILL.md`). Copy locator
   expressions from the POM under `sut_root`. Skip every
   `data/analysis.json` anti-pattern (`do_not_copy`). Do not invent
   selectors. If a When/Then has no harvested locator, stop and escalate.
3. **locator-strategy** — rank live or harvested candidates (`rejected: null`)
4. **pom-builder** — write locators only in `pages/`, extending
   `BasePage` from `src/pages/base-page.ts`. Do not paste `waitForTimeout`,
   XPath, hashed CSS, or boolean POM methods.
5. **assertion-author**

## Structure

- `test.describe('Feature name', { tag: [Tags.*] }, () => {...})`
- Import `Tags` and `testTimeouts` from `@fixtures`
- `test.setTimeout(testTimeouts.standard)` at describe level
- No `try/catch` in spec files
- No Playwright `page` fixture in the spec (Page Object from `@fixtures`)

Calibrate against `golden_dataset/` (parity shape) and
`golden_dataset/dirty/` (forbidden Playwright patterns).

Wait for hook / `npm run gate:migration` PASS, then spawn
`migration-code-reviewer` as a **subagent**. First generate
`REVIEW_CONTEXT` with `npm run verdict:context -- migration-code-reviewer
<spec>`. After return, run `npm run verdict:check --
migration-code-reviewer <spec>` and route only from that exit status.
