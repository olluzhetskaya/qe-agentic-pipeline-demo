---
name: scenario-coverage
description: >
  Use when grouping inventoried Cucumber scenarios into migrate / skip
  decisions. Phase 0b of the migration pipeline. Always a human gate.
  Same session as cucumber-inventory — not a subagent.
---

# Skill: Scenario Coverage

## When to use

Phase 0b — after `data/inventory.json` has
`status: "AUTO_PROCEED"`, `data/analysis.json` exists, and
`npm run gate:migration` PASS.
Do not start if status is `WAITING`. Before `cucumber-mapping` writes steps.
Read `data/analysis.json` anti-patterns. They are rewrite/do-not-copy
facts, not automatic Drop reasons. Do not drop a scenario only because
its POM uses `waitForTimeout`.

## What a coverage group is

A group answers: *which inventoried scenarios belong together for one
Playwright spec or one skip decision?*

It is not a Playwright test. It has no locators and no expected results.

## Rules

1. One group per distinct user behavior. Background steps stay with every
   scenario in that feature; do not invent a second copy.
2. Name the group from the feature/scenario language, not from a locator.
3. Every group cites inventory feature path + scenario name. No group
   without a source row in `inventory.json`.
4. Tag candidacy: `Automate`, `Manual-only`, `Defer`, or `Drop`.
   - `Drop` needs a reason a human can accept (duplicate, obsolete tag,
     out of product scope). Do not drop a failing Then to make migration easier.
5. Scenario Outline rows stay one group unless examples test different
   behaviors.

## Human gate

Show a table: group, source scenarios, candidacy, reason for Drop/Defer.

**Stop.** Wait for explicit go-ahead. Wrong coverage rewrites every mapping
row.

## Batch gate

Inventory and coverage cover the full suite once. Mapping and generation
run on one batch at a time.

After the human accepts the coverage table, **stop again**. Propose slices
(`BATCH-1`, `BATCH-2`, …). A slice uses one or more of:

- feature paths copied from `inventory.json` (`scope_feature_paths`)
- Gherkin tags copied from the inventory (`scope_tags`)
- case ids after mapping exists (`case_ids`)

Do not start `cucumber-mapping` until the human names `batch.id` and at
least one scope field. Write that object on `data/run-state.json`.
Leave `0a_inventory` and `0b_coverage` as `pass`. Set `stage` to
`0c_mapping`.

Then apply `cucumber-mapping` in this session. Do not spawn a judge here.
