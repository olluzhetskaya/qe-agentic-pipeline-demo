# Sensitive Domains (mandatory manual review)

Some areas of the platform carry regulatory or financial risk that no gate
verdict can discharge. A file whose path contains one of the slugs below is
flagged for human review by `afterFileEdit` even when every gate passes.

The harness holds no list of its own — it reads the slugs from this page. Add
a domain here to extend the flag; do not edit the hook.

## Sensitive domains

1. **Payroll** (`payroll`): monetary calculation and disbursement flows. A wrong
   assertion here can mask an incorrect payment, so a passing test is not
   sufficient evidence — flag it for a human.
2. **PII** (`pii`): employee personal data (identifiers, contact, benefits
   elections). Tests must not assert on real personal values; flag any change
   for privacy review.

## Why this file exists

`src/observability/after-file-edit.ts` matches the edited path against these
slugs and emits `MANUAL REVIEW REQUIRED`. Keeping the list in `wiki/` means the
business decides what is sensitive, and the same declaration is visible to the
isolated reviewers that read `wiki/` before judging.
