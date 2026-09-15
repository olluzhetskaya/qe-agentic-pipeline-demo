# Cucumber → Playwright migration pipeline

You are the **coordinator**. Run the Cucumber-to-Playwright migration
pipeline in this conversation. Sequential work is **skills** (shared
context). Spawn **subagents** only for isolated agents; they return a
verdict to you — they do not pick the next step.

Do not read requirement or test-design artifacts to invent coverage.
Do not spawn `xray-publisher`.

Input: the Cucumber tree at `sut_root` on `data/inventory.json`
(path relative to the repo root, outside git). If that tree is missing or
has no `.feature` files, apply `cucumber-inventory`, persist `WAITING`,
and stop.

Do **not** skip the human gate after coverage. Do **not** start Stage 1
until `data/run-state.json` has `0d_mapping_review: pass`.
Do **not** spawn a judge while `npm run gate:migration` is FAIL.

Isolated review verdicts include `Confidence: NN/100` plus a rationale.
The standing cutoff is 75 with `threshold_basis: "policy"`.
Confidence below that cutoff cannot PASS.
Before spawning an isolated judge, run `npm run verdict:context -- <agent>
<target>` and pass the JSON output as `REVIEW_CONTEXT`. The judge writes the
verdict artifact itself. After it returns, run `npm run verdict:check --
<agent> <target>`. Route only from that exit status. Never translate judge
prose into JSON. If evidence or a requested value does not exist, use `null`;
never invent it.

Update `data/run-state.json` when a stage completes so a compacted
session can resume from disk.

The project `stop` hook belongs to this pipeline. It writes only the
migration draft.

---

## Stage 0 — inventory to mapping

1. Apply `cucumber-inventory` (`.agents/skills/cucumber-inventory/SKILL.md`).
   Scan the directory in `sut_root` only. Persist
   `data/inventory.json`. If the SUT is missing or has no
   features, set `0a_inventory` to `waiting` and stop.

2. Apply `suite-intelligence`
   (`.agents/skills/suite-intelligence/SKILL.md`). Persist
   `data/analysis.json`. Anti-patterns are facts: do not copy them into
   `pages/` later.

3. Apply `scenario-coverage` (`.agents/skills/scenario-coverage/SKILL.md`).
   **Always stop for human go-ahead** on coverage groups. Then **stop for
   batch selection**. Write `batch.id` (`BATCH-n`) plus
   `scope_feature_paths`, `scope_tags`, or `case_ids` on
   `data/run-state.json`. Stage `0c_mapping` and later require
   a named batch.

4. Apply `cucumber-mapping` (`.agents/skills/cucumber-mapping/SKILL.md`)
   for the current batch only. Append to `data/mapping.json`.
   Do not rewrite earlier-batch rows. Wait for `afterFileEdit` /
   `npm run gate:migration` PASS. Do not spawn the judge while the gate is FAIL.

5. Spawn **`migration-design-reviewer`**
   (`.agents/agents/migration-design-reviewer.md`) as a subagent.
   Give it the exact `REVIEW_CONTEXT` from
   `npm run verdict:context -- migration-design-reviewer data/mapping.json`.
   Run `npm run verdict:check -- migration-design-reviewer
   data/mapping.json`. Do not interpret its prose.
   - FAIL → re-apply `cucumber-mapping`, then spawn the reviewer again.
   - PASS → show the summary table; wait for human confirmation before Stage 1.

---

## Stage 1 — mapping to Playwright

6. Apply `cucumber-migrate` (`.agents/skills/cucumber-migrate/SKILL.md`)
   for `Automate` cases whose `batch_id` equals `run-state.batch.id`.
   Use `data-layer`, `explore-browser` or `legacy-locator-harvest`,
   `locator-strategy`, `pom-builder`, `assertion-author`. Write specs
   under `tests/`. Write new
   Page Objects under `pages/`. Keep prior-batch specs. Hook /
   `npm run gate:migration` must PASS.

7. Spawn **`migration-code-reviewer`**
   (`.agents/agents/migration-code-reviewer.md`).
   Give it `REVIEW_CONTEXT` from `npm run verdict:context --
   migration-code-reviewer <spec>`.
   FAIL → fix via `cucumber-migrate`, spawn the reviewer again.
   Do not self-review. Run `npm run verdict:check --
   migration-code-reviewer <spec>` and route only from its exit status.

8. Spawn **`migration-pr-drafter`** (`.agents/agents/migration-pr-drafter.md`)
   only after `npm run gate:migration` PASS and hash-fresh judge PASS files
   for the mapping and each migrated spec. Draft only; never merge.
   Write `out/draft_migration_pr.md`.

9. Offer the next batch. Keep `0a_inventory` and `0b_coverage` as `pass`.
   Set `batch` to the next `BATCH-n` and scope. Set `0c_mapping` through
   `1c_pr_draft` to `pending`. Set `stage` to `0c_mapping`. Do not delete
   prior mapping rows or specs. Stop until the human confirms the next
   slice.

---

Standing rules (data layer, assertions, merge block, no invented values)
stay in `AGENTS.md` — this command is the workflow, that file is not.
