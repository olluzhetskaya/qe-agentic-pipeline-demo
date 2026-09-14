/**
 * Tenant fixtures for the QE pipeline demo.
 *
 * Always import entity IDs and config from here — never hard-code
 * 'tenant-growth-01' or similar strings in test bodies. When a tenant's
 * plan set changes, one edit here propagates to every test that uses it.
 *
 * Which fixture serves which wiki rule (wiki/business_domain.md owns the rule
 * text; this is only the pointer):
 *   `tenant-isolation`  → growth01/growth02 for cross-tenant tests
 *   `plan-tier-limits`  → starter01 for plan-count limit tests
 */

export type PlanTier = 'Starter' | 'Growth' | 'Enterprise';

export interface Tenant {
  readonly id: string;
  readonly planTier: PlanTier;
  /** Plan labels visible in the dropdown — matches what the UI renders */
  readonly planLabels: readonly string[];
  /**
   * The plan a happy-path selection test should choose for this tenant.
   * Name the role explicitly instead of indexing `planLabels` — array order
   * is a rendering detail, not a fixture contract. Whether this value is
   * business-valid is covered by tests/review, not the structural data gate.
   */
  readonly defaultPlanLabel: string;
}

export const Tenants = {
  /**
   * Growth-tier, 2-plan configuration.
   * Default for submissions-gating and cross-tenant isolation tests.
   * wiki/business_domain.md rule 3: Growth allows multiple plans.
   */
  growth01: {
    id: 'tenant-growth-01',
    planTier: 'Growth',
    planLabels: ['Dental', 'Vision'],
    defaultPlanLabel: 'Dental',
  },

  /**
   * Growth-tier, 3-plan configuration.
   * Use as "Tenant B" in isolation tests alongside growth01.
   */
  growth02: {
    id: 'tenant-growth-02',
    planTier: 'Growth',
    planLabels: ['Medical', 'Dental', 'Vision'],
    defaultPlanLabel: 'Medical',
  },

  /**
   * Starter-tier, 1-plan configuration.
   * Use specifically for plan-count-limit tests (business_domain.md rule 3).
   * Do NOT use for isolation tests — wiki says to use Growth/Enterprise there.
   */
  starter01: {
    id: 'tenant-starter-01',
    planTier: 'Starter',
    planLabels: ['Medical'],
    defaultPlanLabel: 'Medical',
  },

  /**
   * Enterprise-tier, 4-plan configuration.
   * Use for full multi-plan flow validation.
   */
  enterprise01: {
    id: 'tenant-enterprise-01',
    planTier: 'Enterprise',
    planLabels: ['Medical', 'Dental', 'Vision', 'Life'],
    defaultPlanLabel: 'Medical',
  },
} as const satisfies Record<string, Tenant>;
