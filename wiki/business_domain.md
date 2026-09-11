# Business Domain: Tenant Onboarding (HCM Platform)

This wiki page is the retrieval context the spec-checker agent grounds every
generated test against. Keep it short and rule-shaped — the agent reads this,
not a full requirements doc.

## Core entities

- **Tenant** — a customer organization. Has a `plan_tier` (Starter / Growth / Enterprise).
- **Employee** — belongs to exactly one Tenant. Has an `onboarding_status`
  (`invited` → `profile_complete` → `benefits_selected` → `active`).
- **BenefitPlan** — belongs to a Tenant. An Employee must select one before
  their onboarding can complete.

## Business rules an agent-generated test must respect

1. **Submission gating**: the onboarding wizard's "Finish" button stays
   disabled until `benefits_selected` is reached. A test that asserts the
   button is enabled before benefit selection is testing the wrong behavior —
   flag it, don't just assert it.
2. **Tenant isolation**: no UI flow may show BenefitPlans belonging to a
   different Tenant, even in dropdowns. This is the #1 regression risk on this
   platform (multi-tenant SaaS) and should be spot-checked in any onboarding
   test that touches the plan-selection screen.
3. **Plan tier limits**: Starter-tier tenants may only offer 1 BenefitPlan;
   Growth and Enterprise allow multiple. A generated test for plan selection
   should use a Growth or Enterprise fixture tenant unless it is specifically
   testing the Starter limit.

## Why this file exists

The `code-reviewer` agent (`.agents/agents/code-reviewer.md`) retrieves this
file (or a chunk of it) before reviewing a generated test. It's what lets
the semantic/judge gate catch a test that is *syntactically* fine but
*semantically* wrong — e.g., a test that passes but checks a rule that
doesn't reflect rule #1 above.
