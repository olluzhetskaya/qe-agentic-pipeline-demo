# Cucumber → Playwright migration

This folder is a self-contained project for ADR-015 and ADR-016. It does
not use the requirement-to-spec pipeline.

## Open this folder as the workspace

Open `migration/` as the Cursor workspace root. Cursor does not load this
project's `.cursor/hooks.json` or slash command when only the parent repo
is open.

Then install and validate:

```bash
npm ci
npm run validate
```

## Point at the legacy framework

The Cucumber tree lives **outside** this git repo. Set `sut_root` on
`data/inventory.json` to a path relative to this project root. This
checkout uses `../../legacy-ta-framework`.

See `sut/README.md`. Do not copy a nested `.git` or `.env` into `sut/`.

Expected inputs (names may differ; the inventory skill records what it
finds):

- `*.feature` files
- step-definition modules
- support / hooks / World

Do not rewrite Gherkin in the legacy tree. The mapping artifact is
`data/mapping.json`. Generated Playwright lives in `tests/` and
`pages/`.

Inventory and coverage run once for the suite. Mapping and generation
use one `batch` (`BATCH-n` plus feature paths, tags, or case ids). After
a draft PR, keep 0a/0b as `pass` and start the next batch.

If `sut_root` is missing or has no feature files,
`data/run-state.json` stays at `0a_inventory` with status `waiting` and
`batch.id` null.

## Source anti-patterns

After inventory, run `npm run scan:source`. The script writes
`data/analysis.json`. It lists legacy waits, XPath, hashed CSS, and
boolean probes. Stage 1 harvests locators from the POM but does not copy
those statements. Target `pages/` and `tests/` fail the gate if they
contain `waitForTimeout`, XPath, or hashed CSS.

## Cost

Gates do not require Langfuse. Price does.

Create API keys in the Langfuse project named **migration**. Put them in
the gitignored `.env` file:

```text
LANGFUSE_PROFILE=migration
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_TRACING_ENVIRONMENT=development
```

Do not paste keys into chat or commit them. Cost for `/migrate-pipeline`
lands in that project.

Type `/migrate-pipeline`. The requirement-to-spec command is not part of
this project.

```bash
npm run validate
```

In Langfuse, open **Sessions** and select the Cursor conversation. Open
**Analytics → Costs** for project totals. The
`real_conversation_cost_cents` score is present only when the optional
Cursor usage credentials are configured.
