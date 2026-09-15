---
name: legacy-locator-harvest
description: >
  Use in Stage 1 when a new Page Object needs locators and the live UI
  is not available. Copy locator expressions from the legacy POM under
  sut_root. Skip anti-patterns listed in data/analysis.json. Do not
  invent selectors.
---

# Skill: Legacy Locator Harvest

## When to use

Inside `cucumber-migrate`, after `data-layer`, when:

1. `pages/` does not yet cover the Gherkin When/Then, and
2. `explore-browser` cannot open the SUT (no `BASE_URL`, no auth, login
   page, or the session fails)

Do not use this skill to skip a live scrape when the UI **is** available.
Live scrape wins. Harvest is the fallback.

## What “copy” means

Read the step-definition `glue` path from `data/inventory.json`. Open
that file. Follow its imports into `packages/pom/` (or the POM folder
the suite actually uses). Copy **locator expressions** that already
exist, with `path:line`.

This is source-to-source. It is not a guess.

## Refuse to copy

If `data/analysis.json` lists the same `path` + `line` (or the statement
matches an anti-pattern kind), do **not** copy it:

- `waitForTimeout`
- `xpath=` locators
- hashed CSS (`css-…`)
- `Promise<boolean>` POM methods
- `expect(...).toBe(true)`
- `isVisible()` / `isEnabled()` used as a wait

Keep the **intent** (click, fill, assert visible). Write the target
shape with `locator-strategy` and `pom-builder` (`getByRole`,
`getByTestId`, public `Locator` + web-first matcher).

## Stop instead of inventing

If the Gherkin When/Then has no locator in the legacy POM and no live
scrape, persist WAITING:

- `reason`: which step text has no source locator
- `escalate`: needs live UI, or a `data-testid` on the app

Do not write `page.locator('div.foo >> nth=3')` from memory.

## Artifact

Write `.agents/artifacts/harvest-{featureSlug}-{YYYY-MM-DD}.yaml`:

```yaml
meta:
  source: legacy_pom
  sut_root: ../../legacy-ta-framework
  inventory_sha256: sha256:...
locators:
  - gherkin: I click on All Dashboards on the left column
    expression: "page.getByRole('link', { name: 'All Dashboards' })"
    from: packages/pom/src/v1.0/implementations/GCRM/tabs/DashboardListTab.ts:8
    rejected: null
  - gherkin: (scroll helper)
    expression: waitForTimeout(500)
    from: packages/pom/src/v1.0/implementations/GCRM/components/CRMComponent.ts:17
    rejected: wait_for_timeout
```

Hand `locators[]` where `rejected` is `null` to `locator-strategy`.
List `rejected` rows in the draft PR as “not copied.”

## Target POM rules still apply

The new class lives under `pages/`, extends `BasePage`, uses
`private readonly` / `public readonly Locator`, and must pass ESLint
and ast-grep. A harvested `getByRole` may be copied. A harvested
`waitForTimeout` may not.
