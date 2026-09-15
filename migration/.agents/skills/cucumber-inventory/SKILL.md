---
name: cucumber-inventory
description: >
  Use when starting a Cucumber-to-Playwright migration. Phase 0a — scan
  the tree in inventory `sut_root` and write data/inventory.json.
  Main session, not a subagent. Stop with WAITING if the legacy tree is
  missing.
---

# Skill: Cucumber Inventory

## When to use

Phase 0a of `/migrate-pipeline`. Before coverage or mapping.
Do not read `data/requirement.json` or `data/test-design.json`.

## What to scan

Read `sut_root` from `data/inventory.json`. Resolve it from
the repo root. Scan that directory only. Record what exists. Do not
invent a feature, scenario, step, or glue file.

Skip every `node_modules` directory. A legacy tree carries its own
dependencies, and Cucumber packages ship `.feature` files as test
fixtures. Those are vendor files, not SUT scenarios.
`migration-gates.ts` applies the same exclusion.

Collect:

1. `*.feature` paths (relative to `sut_root`), feature names, tags, and
   scenario (or outline) names
2. Step-definition modules (common globs: `**/*steps*`,
   `**/step_definitions/**`, `**/*.js`, `**/*.ts`, `**/*.rb`)
3. Hooks / World / support files when present

For each scenario, copy Gherkin steps verbatim (`keyword` + `text`).
When you can bind a step to a definition, store `glue` as `path:line`
relative to `sut_root`. When you cannot bind it, store `glue: null`.
An empty Examples cell is JSON `null`, not `""`.

## Empty SUT

If `sut_root` does not exist, or it has no `*.feature` file outside
`node_modules`:

1. Keep `sut_root` as the configured path. Write
   `data/inventory.json` with `status: "WAITING"`, a non-empty
   `reason`, and a non-empty `escalate` array.
2. Set `data/run-state.json` stage `0a_inventory` to
   `waiting`. Keep `batch.id` null.
3. Stop. Do not create mapping cases.

## Populated SUT

1. Set `status: "AUTO_PROCEED"`, `reason: null`, `escalate: null`.
2. Fill `features`, `step_definitions`, and `hooks`.
3. Set `0a_inventory` to `pass` and `stage` to `0b_coverage`.
4. Run `npm run scan:source`. That writes `data/analysis.json`.
5. Run `npm run gate:migration`. Fix findings before `scenario-coverage`.

Never substitute `"unknown"`, `"N/A"`, `"TBD"`, or an empty string. Use
JSON `null` for a missing bind.

Wait for the gate PASS, then apply `scenario-coverage`.
