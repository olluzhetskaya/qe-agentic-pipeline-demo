"""
Hand-written reference test — this is what the test_generator agent's output
is supposed to look like. Compare against golden_dataset/clean/clean_01.py:
same pattern, same skill rules applied.
"""
from src.pages.onboarding_page import OnboardingPage


def test_finish_disabled_before_plan_selection(page):
    onboarding = OnboardingPage(page)
    onboarding.goto("/onboarding/wizard")

    assert onboarding.is_finish_enabled() is False


def test_finish_enabled_after_plan_selection(page):
    onboarding = OnboardingPage(page)
    onboarding.goto("/onboarding/wizard")
    onboarding.select_benefit_plan("Dental")

    assert onboarding.is_finish_enabled() is True
