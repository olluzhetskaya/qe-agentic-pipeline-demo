---
name: data-layer
description: >
  Use when a test needs fixture data that does not yet exist, or when
  extending tenants, employees, plans, tags, or timeouts. Create typed
  entries under src/data/, wire them through src/fixtures/, then consume
  them in specs — never hard-code IDs in test bodies.
---

# Skill: Data Layer

Typed fixtures live under `src/data/`. Specs import them only through
`src/fixtures/` (`@fixtures`). Discover what already exists; do not assume
a fixed file list.

| Location | Role |
|---|---|
| `src/data/` | Entity types, fixture records, tags, timeouts |
| `src/fixtures/` | Extended Playwright `test` / `expect`, POM injection, re-exports |
| `data/mapping.json` | Approved behavior and fixture handles |

This skill is **create first, then use**. If the case needs a tenant,
employee, plan, tag, or timeout that is not in `src/data/`, add it here
before writing the spec.

---

## 1. Decide: reuse or create

1. Read `data/mapping.json` and `data/inventory.json` for the behavior and source data.
2. Search `src/data/` for an existing record that already has the right
   tenant, tier, onboarding status, or plan set.
3. **Reuse** if one matches. **Create** if the case needs a new combination
   (different tier, status, cross-tenant pair, extra plan, new entity).
4. Never invent IDs or labels as string literals in a spec to dodge creating
   a fixture.

---

## 2. Create — same entity type

Add a named key on the existing record object in `src/data/`:

- Name the key by role, not by ticket (`midOnboarding`, not `kb4821Emp`).
- Comment which wiki rule the record is for.
- Cross-link IDs through existing fixtures (`tenantId: Tenants.growth01.id`),
  never a duplicated string.
- Keep `as const satisfies Record<string, T>` on the object so new keys
  stay typed and required fields are checked at compile time.
- Plans belong to exactly one tenant. Do not reuse a plan record across
  tenants; add a new key.

IDs stay unique across the module. Labels in tenant `planLabels` must match
the plan names that tenant actually owns, and `defaultPlanLabel` must be one
of them.

Address a fixture by role, never by position. When a spec needs "a plan this
tenant offers," add or read a named field (`defaultPlanLabel`) instead of
indexing `planLabels[0]` — array order is a rendering detail, so an index
silently changes meaning the moment the list is reordered.

---

## 3. Create — new entity type

When the mapping introduces an entity that `src/data/` does not model yet:

1. Add a module under `src/data/` with an interface and a `as const satisfies
   Record<string, T>` object — same shape as the existing modules.
2. Re-export the const from `src/fixtures/` so specs still have one import.
3. If tests need a new Page Object for that entity, `pom-builder` owns the
   page class; this skill only owns the data record and the `@fixtures`
   re-export.

Shared tags and timeouts also live under `src/data/`. Add a tag when a new
filterable concern appears; add a timeout key only for a real duration class
(standard / extended / expect) — not a one-off magic number in a spec.

---

## 4. Use in a spec

```typescript
import { test, expect, Tenants, Employees } from '@fixtures';

test('…', async ({ onboarding }) => {
  const tenant = Tenants.growth01;
  await onboarding.gotoWizard(tenant.id);
  await onboarding.selectBenefitPlan(tenant.defaultPlanLabel);
  await expect(onboarding.planOptions).toHaveText([...tenant.planLabels]);
});
```

Never `import { test } from '@playwright/test'`. Never a separate `@data/*`
import in a spec — `@fixtures` re-exports the data.

Pick the record that matches the wiki rule: an onboarding-state rule needs the
employee in that state, an isolation rule needs two tenants, and a cardinality
rule needs fixtures at the boundary stated in the rule prose. Read the rule in
the approved mapping rather than assuming values. The data gate checks schema and placement,
not whether a fixture satisfies business policy. If no record matches, go back
to §2.

---

## What not to do

| Anti-pattern | Why |
|---|---|
| Hard-coded `'tenant-growth-01'` or `'Dental'` in a spec | Drifts when the fixture changes |
| `planLabels[0]` to mean "the plan to select" | Positional index; reordering the array changes the test silently |
| New entity as a local `const` in the spec | Belongs in `src/data/` |
| Plan shared across two tenants | Isolation rule: a plan belongs to one tenant |
| Duplicate ID strings instead of `Tenants.*.id` | Two sources of truth |
| Module-scope `let` for fixture values | Breaks parallel runs |
| Edit fixtures to make one test pass and break others | Add a key; do not mutate an existing one |

`code-reviewer` and the stop hook treat data-layer bypass as FAIL.
See `golden_dataset/clean/` (correct) and `golden_dataset/dirty/`
(hard-coded IDs, shared mutable state).
