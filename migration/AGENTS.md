# AGENTS.md — Cucumber-to-Playwright Migration

This project implements ADR-015 and the separation in ADR-016. Open this
`migration/` folder as the Cursor workspace root. Run `/migrate-pipeline`.
Do not run `/qe-pipeline`.

## Writing

Use short sentences, active voice, and simple technical words. Give one fact
or instruction per sentence.

## Project boundary

- This project does not read Jira requirement artifacts or publish to Xray.
- Do not import a file outside this project root.
- The legacy Cucumber tree is an external read-only input. `sut_root` in
  `data/inventory.json` is its path.
- Do not copy a nested `.git`, `.env`, or `node_modules` into `sut/`.
- Do not invent features, scenarios, steps, selectors, or data.

## Pipeline

- Inventory and coverage run once for the suite.
- Mapping, generation, review, and the draft PR run per `BATCH-n`.
- A human confirms coverage and the proposed batch before mapping.
- Do not write a current-batch spec before mapping review passes.
- Keep prior mapping rows and specs.

## Isolated agents

The coordinator writes inventory, coverage, mapping, and specs. Use isolated
agents only for:

- `migration-design-reviewer` — fresh-context mapping judge.
- `migration-code-reviewer` — fresh-context spec judge.
- `migration-pr-drafter` — draft only, no terminal, never merge.

Judges write typed verdicts under `data/verdicts/`. Route only from
`npm run verdict:check`. The PASS cutoff is 75 with
`threshold_basis: "policy"`.

## Test code

- Specs live under `tests/`. Page Objects live under `pages/`.
- Specs import only from `@fixtures`.
- Put typed data in `src/data/` and export it through `src/fixtures/`.
- Assert on a Locator with a web-first matcher.
- Prefer a live scrape for locators. If the UI is missing, harvest
  locators from the legacy POM. Do not guess. Do not copy anti-patterns
  from `data/analysis.json`.

## Gates

- Run `npm run validate` before review.
- `afterFileEdit` runs the same migration gate on watched files.
- The `stop` hook requires hash-fresh migration judge PASS files.
- The PR drafter writes `out/draft_migration_pr.md`. A human merges.
