---
name: explore-browser
description: >-
  Session bootstrap for live browser exploration — auth resolution, named
  playwright-cli session, login verification, API capture fields, and
  exploration artifact I/O. Use when test creation or locator debugging needs
  a live authenticated page. Does not define locator strategy.
---

# Explore Browser — Session Bootstrap

Open an authenticated named session, record network calls while walking the page, write the exploration artifact, close the session.

## Where this sits

Stage 1 support skill. The coordinator applies it inside `cucumber-migrate`,
after `data-layer` and before `locator-strategy` / `pom-builder`. It is not
a Stage 0 step, a judge, or a `run-state.json` checkpoint.

Use it when:

- a new Page Object needs locators from a live page
- an existing locator is stale or a spec/POM repair needs a fresh scrape

Skip the walk when `pages/` already covers the flow and no locator is
missing. If the session cannot open, do not invent locators. Apply
`legacy-locator-harvest` instead. Stop only when harvest also has no
source locator for that step.

This skill does not choose locator strategy. Scrape candidates into
`locators[]`. `locator-strategy` ranks them. `pom-builder` writes them
only under `pages/`. Specs never take scraped strings.

## Session Bootstrap

### 1. Resolve auth

**Resolution order:**

1. Caller-provided `authFile` (preferred)
2. Project default from [[environment-auth-table]]
3. Pool/worker file from fixture name (see [[environment-auth-table]])
4. Run global setup: `npx playwright test tests/global.setup.ts --project=setup`
5. **STOP** and ask user — never guess credentials

Verify file exists: `test -f <authFile>`

### 2. Open named session

Use session name `explore` for isolation from other CLI work:

```bash
playwright-cli -s=explore open {baseURL}
playwright-cli -s=explore state-load {authFile}
playwright-cli -s=explore goto {baseURL}{url}
playwright-cli -s=explore snapshot --filename=.agents/artifacts/_snap-initial.yaml
```

### 3. Verify authenticated

From snapshot: app shell / feature content visible — **not** login form or redirect to `/login`.

If login form appears:

- Auth stale → run global setup (step 1.4) and retry
- Wrong auth file → STOP with `{ needsAuth: true, authFile, reason }`

### 4. Walk the page

Use the live session for the requested flow. Locator choice and probing are a separate capability (matched from the task or named by `create-ui-test`).

---

## API capture

While performing each user action, record network calls (DevTools Network or `playwright-cli` trace):

| Field                              | How to fill                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `trigger`                          | User action that fired the request                        |
| `method`                           | GET / POST / PUT / PATCH / DELETE                         |
| `pathPattern`                      | URL path (no host)                                        |
| `typedClient`                      | Grep `src/helpers/api/` for existing method               |
| `openApiRef`                       | `src/types/generated/client-api.d.ts` or `staff-api.d.ts` |
| `requestFields` / `responseFields` | From OpenAPI or live response                             |

If no typed client exists → set `apiCalls[].needsClient: true`.

---

## Write artifact

After the walk:

```bash
mkdir -p .agents/artifacts
```

**Path:** `.agents/artifacts/explore-{featureSlug}-{YYYY-MM-DD}.yaml`

Required top-level keys: `meta`, `locators[]`, `apiCalls[]`, `scenarios[]`, `pomPlan`.

Report:

- Artifact path
- Locator count (probed)
- Scenario count
- Any `needsClient` or `reusedFrom` flags

### Close session

```bash
playwright-cli -s=explore close
```

---

## Standalone locator debug

When the user asks to explore a page or find locators without creating a test,
or when a POM locator is broken:

1. Run Session Bootstrap
2. Probe / scrape the requested elements only
3. Write `locators[]` into the artifact, or return a locator table in chat
4. Hand the scrape to `locator-strategy`, then patch `pages/` via `pom-builder`
5. Close the session
