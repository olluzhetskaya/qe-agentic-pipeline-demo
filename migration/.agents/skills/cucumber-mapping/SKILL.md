---
name: cucumber-mapping
description: >
  Use when turning confirmed coverage groups into a Gherkin-to-Playwright
  mapping. Phase 0c. Distinct from cucumber-migrate (the spec). Same
  session as 0a/0b — not a subagent. After gate PASS, invoke
  migration-design-reviewer as an isolated agent.
---

# Skill: Cucumber Mapping

## When to use

Phase 0c — after `scenario-coverage` has a confirmed set of groups and a
named batch on `data/run-state.json`.
Output is `data/mapping.json`.

Map only scenarios that match the current `batch` scope. Leave rows from
earlier batches in place. Do not rewrite their `playwright` steps.

## Map one inventory scenario to one case

Each in-scope `Automate` group becomes one or more cases with id `MIG-n`.
Set `batch_id` to the current `batch.id`. Set `automation_status` to
`Not yet automated` for this batch. Prior-batch `Automate` rows stay
`Automated`.

| Gherkin | Mapping field |
|---|---|
| Background + Given | `playwright.steps[].action` (setup) |
| When | `playwright.steps[].action` + `data` |
| Then / And (assertion) | `playwright.steps[].result` |

Copy step `text` from the inventory. Do not rewrite the behavior as a new
acceptance criterion. `data` is `-` or a `@fixtures` handle that exists
(or that `data-layer` will create in Stage 1). Do not paste production IDs.

For in-scope `Manual-only`, `Defer`, and `Drop`, store the decision and
`drop_reason` / notes. Set `playwright` to `null`. Set
`automation_status` to `Not yet automated`.

Set `inventory_sha256` to the sha256 of `data/inventory.json`
as `sha256:` plus 64 lowercase hex characters.

Vague results (`should work`, `correctly`, `as expected`) are FAIL. Replace
them with the Then text from Gherkin, or FAIL the row back to a human.

## After write

1. Set run-state `0c_mapping` to `pass` and `stage` to `0d_mapping_review`.
2. Wait for `afterFileEdit` or `npm run gate:migration` PASS.
3. Generate `REVIEW_CONTEXT` with
   `npm run verdict:context -- migration-design-reviewer data/mapping.json`.
4. Spawn `migration-design-reviewer`. Do not review your own mapping.
