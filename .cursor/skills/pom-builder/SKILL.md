---
name: pom-builder
description: >
  Use when generating or modifying a Page Object for the onboarding platform.
  Builds a Page class that inherits BasePage, encapsulates locators as private
  attributes, and exposes fluent public methods (not raw locator access).
---

# Skill: POM Builder

## When to use
Any time a generated test needs to interact with a page/screen that doesn't
already have a Page Object in `src/pages/`.

## Rules this skill enforces
1. Every Page class inherits `BasePage` (see `src/pages/base_page.py`).
2. Locators are private (`_prefixed`) and defined once, at the top of the class.
3. Public methods are actions or queries in business language
   (`select_benefit_plan(name)`, not `click_dropdown_item(x)`).
4. No locator string appears outside the Page Object it belongs to — a test
   file that contains a CSS/XPath string directly is a violation the
   code-reviewer subagent should flag.
5. Every interaction method uses an explicit wait (`expect(...).to_be_visible()`
   or equivalent) before acting — never a bare `page.click()` with no prior wait.

## Output shape
A single `.py` file under `src/pages/`, following the pattern in
`src/pages/onboarding_page.py`.
