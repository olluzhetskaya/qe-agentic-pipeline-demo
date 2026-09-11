"""
GOLDEN: clean_02 — no cross-tenant BenefitPlan leakage (AC-3).
Why this is 'clean': directly tests the #1 regression risk called out in
wiki/business_domain.md (tenant isolation), using a Growth-tier fixture as
that rule specifies, not an arbitrary tenant.
"""
from src.pages.onboarding_page import OnboardingPage


def test_no_cross_tenant_plans_visible(page, growth_tier_tenant_fixture):
    onboarding = OnboardingPage(page)
    onboarding.goto(f"/onboarding/wizard?tenant={growth_tier_tenant_fixture.id}")

    visible_plans = onboarding.visible_plan_options()

    assert all(
        plan.tenant_id == growth_tier_tenant_fixture.id
        for plan in growth_tier_tenant_fixture.resolve_plans(visible_plans)
    ), "AC-3 violated: a plan from a different tenant is visible in the dropdown"
