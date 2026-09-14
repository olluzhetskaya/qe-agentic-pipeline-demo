/**
 * BenefitPlan fixtures for the QE pipeline demo.
 *
 * Plans are scoped to a tenant — never share plan fixtures across tenants.
 * Import plan names from here rather than writing 'Dental' or 'Vision' inline.
 *
 * Business suitability is defined in wiki/business_domain.md and verified by
 * tests/review. `data-gates.ts` checks only this module's structural schema,
 * export boundary, and literal-ID uniqueness.
 */
import { Tenants } from './tenants';

export interface BenefitPlan {
  readonly id: string;
  readonly name: string;
  readonly tenantId: string;
}

export const Plans = {
  /** Growth01 plans — visible to Tenant growth01 employees only */
  dentalGrowth01: {
    id: 'plan-dental-g01',
    name: 'Dental',
    tenantId: Tenants.growth01.id,
  },
  visionGrowth01: {
    id: 'plan-vision-g01',
    name: 'Vision',
    tenantId: Tenants.growth01.id,
  },

  /** Growth02 plans — must NOT appear in growth01 dropdown (isolation rule) */
  medicalGrowth02: {
    id: 'plan-medical-g02',
    name: 'Medical',
    tenantId: Tenants.growth02.id,
  },
  dentalGrowth02: {
    id: 'plan-dental-g02',
    name: 'Dental',
    tenantId: Tenants.growth02.id,
  },
  visionGrowth02: {
    id: 'plan-vision-g02',
    name: 'Vision',
    tenantId: Tenants.growth02.id,
  },

  /** Starter01 — its only plan; the cap comes from the `plan-tier-limits` rule */
  medicalStarter01: {
    id: 'plan-medical-s01',
    name: 'Medical',
    tenantId: Tenants.starter01.id,
  },

  /** Enterprise01 plans — full multi-plan configuration */
  medicalEnterprise01: {
    id: 'plan-medical-e01',
    name: 'Medical',
    tenantId: Tenants.enterprise01.id,
  },
  dentalEnterprise01: {
    id: 'plan-dental-e01',
    name: 'Dental',
    tenantId: Tenants.enterprise01.id,
  },
  visionEnterprise01: {
    id: 'plan-vision-e01',
    name: 'Vision',
    tenantId: Tenants.enterprise01.id,
  },
  lifeEnterprise01: {
    id: 'plan-life-e01',
    name: 'Life',
    tenantId: Tenants.enterprise01.id,
  },
} as const satisfies Record<string, BenefitPlan>;
