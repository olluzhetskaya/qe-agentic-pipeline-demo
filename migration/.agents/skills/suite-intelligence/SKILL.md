---
name: suite-intelligence
description: >
  Use after cucumber-inventory when inventory status is AUTO_PROCEED.
  Scan the legacy tree for duplicates, unbound steps, and anti-patterns
  that must not be copied into the target Playwright suite. Write
  data/analysis.json. Facts only — not a migrate/skip decision.
---

# Skill: Suite Intelligence

## When to use

After `data/inventory.json` has `status: "AUTO_PROCEED"`. Before
`scenario-coverage`. Not a subagent.

## What it answers

The scan records facts the coverage table and Stage 1 harvest need:

- Unbound Gherkin steps (`glue: null`)
- Duplicate scenario step sequences
- Skip / ignore tags on scenarios
- **Anti-patterns in legacy POM and step files** that the target suite
  must not copy

It does not decide Automate / Drop. The human does that in coverage.

## Anti-patterns (do not copy)

| Kind | Source example | Target action |
|---|---|---|
| `wait_for_timeout` | `page.waitForTimeout(500)` | Drop. Use Locator auto-retry. |
| `xpath_locator` | `locator('xpath=//...')` | Do not copy. Escalate `data-testid`. |
| `hashed_css` | `locator('.css-3hj5v2')` | Do not copy. Escalate `data-testid`. |
| `boolean_literal_assertion` | `expect(x).toBe(true)` | Rewrite to a web-first matcher. |
| `boolean_pom_method` | `async isX(): Promise<boolean>` | Expose `Locator`, assert in the spec. |
| `visibility_probe_as_wait` | `await locator.isVisible()` as a wait | Drop as a wait. If it is an assertion, use `toBeVisible()`. |

A locator string that is `getByRole`, `getByTestId`, `getByLabel`,
`getByPlaceholder`, or `getByText` may be harvested. See
`legacy-locator-harvest`.

## Empty or missing SUT

If `sut_root` is missing, do not invent findings. Keep analysis
`anti_patterns: []` and set `baseline: null` with a reason. Unbound
counts still come from the inventory file.

## Output

Write `data/analysis.json`:

- `inventory_sha256` — same scheme as mapping (`sha256:` + hex)
- `sut_root` — copied from inventory
- `updated_at` — ISO-8601
- `unbound_step_count` — integer from inventory
- `anti_patterns[]` — `{ kind, path, line, excerpt, action }`
  - `action` is `do_not_copy` or `rewrite`
  - `path` is relative to `sut_root`
  - `excerpt` is the source text, not a guess
- `baseline` — `{ run_id, passed, failed, skipped }` or `null`

`action` `do_not_copy` means Stage 1 must not paste that statement into
`pages/` or `tests/`. `rewrite` means keep the intent, change the shape.

Never substitute `"unknown"`. Use `null` for baseline when the legacy
suite cannot run.

Regenerate with `npx tsx scripts/scan-anti-patterns.ts` when the
inventory hash changes. Then `npm run gate:migration`.
