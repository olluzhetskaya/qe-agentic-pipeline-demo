---
name: locator-strategy
description: >
  Use when a Page Object needs new locators. Enforces the locator priority
  order so generated tests don't rot the first time the DOM shifts.
---

# Skill: Locator Strategy

## Priority order (highest to lowest)
1. `data-testid` attribute — always prefer this if it exists on the element.
2. Accessible role + name (`get_by_role("button", name="Finish")`).
3. Visible text (`get_by_text(...)`) — only for stable, non-localized labels.
4. CSS class — last resort, and only if the class name is semantic
   (`.benefit-plan-card`), never a generated/hashed class.

## Hard rule
Never generate an XPath locator. If the only available option is XPath, flag
it back to the ticket as "needs a `data-testid`" instead of writing brittle
XPath.
