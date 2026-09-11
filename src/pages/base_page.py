"""
BasePage — every generated Page Object inherits this.

Enforces the two POM rules that matter most for agent-generated code:
  1. No locator string ever appears outside a Page Object (see pom_builder skill).
  2. Every interaction waits explicitly — no time.sleep(), ever.
"""
from __future__ import annotations

from playwright.sync_api import Page, expect


class BasePage:
    def __init__(self, page: Page):
        self.page = page

    def goto(self, path: str) -> None:
        self.page.goto(path)

    def _click_when_visible(self, locator) -> None:
        expect(locator).to_be_visible()
        locator.click()

    def _fill_when_visible(self, locator, value: str) -> None:
        expect(locator).to_be_visible()
        locator.fill(value)

    def _text_of(self, locator) -> str:
        expect(locator).to_be_visible()
        return locator.inner_text()
