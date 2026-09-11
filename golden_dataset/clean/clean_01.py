"""
GOLDEN: clean_01 — Finish button disabled before plan selection (AC-1).
Why this is 'clean': explicit assertion tied to the AC, no sleep, uses the
Page Object's public methods only (no raw locator string in the test file).
"""
from src.pages.onboarding_page import OnboardingPage


def test_finish_disabled_before_plan_selection(page):
    onboarding = OnboardingPage(page)
    onboarding.goto("/onboarding/wizard")

    assert onboarding.is_finish_enabled() is False, (
        "AC-1 violated: Finish must stay disabled until benefits_selected"
    )
