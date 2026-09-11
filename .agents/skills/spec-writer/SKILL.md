---
name: spec-writer
description: >
  Use when turning a ticket's acceptance criteria into a structured test spec
  (Given/When/Then) before any test code is generated. This is spec-checker's
  output, consumed next by test-generator.
---

# Skill: Spec Writer

## When to use
First step in the pipeline, right after spec-checker retrieves ticket + wiki
context. Never skip straight to code.

## Rules this skill enforces
1. Every acceptance criterion becomes one Given/When/Then block.
2. Each block is tagged `deterministic` or `judge` per the L4 course's
   classification (a hard assertion on a value = deterministic; "the layout
   looks right" = judge, and judge criteria need a human reviewer, not just
   an automated assertion).
3. Business-rule references (e.g. "tenant isolation") are cited inline from
   `wiki/business_domain.md` by section name, so the reviewer can trace the
   spec back to the rule it's protecting.

## Output shape
A structured JSON block (see `data/ticket.json` for the input shape this
consumes) — not prose, not code.
