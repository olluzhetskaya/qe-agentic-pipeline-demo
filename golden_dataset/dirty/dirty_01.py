"""
DIRTY: dirty_01 — seeded violation of the assertion_author skill's rule 3
(no time.sleep + plain assert instead of Playwright's retrying expect()).

This should score FAIL on the semantic gate even though it "runs". If a
generated test looks like this, the judge gate must catch it — this file
exists so we can prove it does, before trusting the gate on real output.
"""
import time

from src.pages.onboarding_page import OnboardingPage


def test_finish_button_bad_pattern(page):
    onboarding = OnboardingPage(page)
    onboarding.goto("/onboarding/wizard")
    onboarding.select_benefit_plan("Dental")

    time.sleep(3)  # <-- violation: hardcoded wait instead of explicit wait
    assert onboarding.page.url  # <-- violation: not a real assertion, just runs
