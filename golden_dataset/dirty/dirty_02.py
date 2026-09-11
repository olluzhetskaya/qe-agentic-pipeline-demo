"""
DIRTY: dirty_02 — syntactically fine, semantically wrong.

This is the case a *static* linter can never catch, which is why the pipeline
has a separate semantic/judge gate. The test asserts Finish is ENABLED before
plan selection — wiki/business_domain.md rule 1 says the opposite is correct.
A generated test that inverts a business rule like this must fail the
semantic gate even though it passes lint, ast-grep, and Sonar cleanly.
"""
from src.pages.onboarding_page import OnboardingPage


def test_finish_enabled_before_selection_WRONG(page):
    onboarding = OnboardingPage(page)
    onboarding.goto("/onboarding/wizard")

    assert onboarding.is_finish_enabled() is True  # inverts business rule 1
