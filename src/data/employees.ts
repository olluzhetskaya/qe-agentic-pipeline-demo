/**
 * Employee fixtures for the QE pipeline demo.
 *
 * Each Employee fixture represents a specific onboarding state.
 * Import from here instead of hard-coding `emp-001` or status strings.
 *
 * Onboarding lifecycle (from wiki/business_domain.md):
 *   invited → profile_complete → benefits_selected → active
 *
 * The "Finish" button only enables at `benefits_selected` and beyond — see the
 * `submission-gating` rule in wiki/business_domain.md for the authority.
 */
import { Tenants } from './tenants';

export type OnboardingStatus =
  | 'invited'
  | 'profile_complete'
  | 'benefits_selected'
  | 'active';

export interface Employee {
  readonly id: string;
  readonly tenantId: string;
  readonly onboardingStatus: OnboardingStatus;
}

export const Employees = {
  /**
   * Mid-onboarding, no benefit plan selected yet.
   * The state to use for submission-gating tests (Finish should be disabled).
   * wiki/business_domain.md rule 1.
   */
  midOnboarding: {
    id: 'emp-001',
    tenantId: Tenants.growth01.id,
    onboardingStatus: 'profile_complete',
  },

  /**
   * Benefit plan already selected — Finish button should be enabled.
   * Use for the positive path of AC-2.
   */
  benefitsSelected: {
    id: 'emp-002',
    tenantId: Tenants.growth01.id,
    onboardingStatus: 'benefits_selected',
  },

  /**
   * Belongs to growth02 — the "other tenant" in cross-tenant isolation tests.
   * Its plans must NOT appear when growth01 employee views the dropdown.
   * wiki/business_domain.md rule 2.
   */
  otherTenantEmployee: {
    id: 'emp-003',
    tenantId: Tenants.growth02.id,
    onboardingStatus: 'profile_complete',
  },

  /**
   * Starter-tier tenant employee — for plan-count-limit tests.
   * wiki/business_domain.md rule 3.
   */
  starterTenantEmployee: {
    id: 'emp-004',
    tenantId: Tenants.starter01.id,
    onboardingStatus: 'profile_complete',
  },
} as const satisfies Record<string, Employee>;
