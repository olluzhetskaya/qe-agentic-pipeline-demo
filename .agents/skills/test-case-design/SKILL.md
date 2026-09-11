---
name: test-case-design
description: >
  Use when turning a test objective into a manual test case in Xray's
  Action / Data / Expected Result step format. This is test-designer's
  primary skill — distinct from spec-writer, which produces automated
  Given/When/Then specs for test-generator, not manual Xray test cases.
---

# Skill: Test Case Design

## When to use
After requirements-analyst has produced testable requirement statements,
before xray-publisher runs. One test case per objective — don't bundle
multiple objectives into a single case just because they're related.

## Rules this skill enforces
1. Every test case has exactly one `linked_objective`, and every objective
   traces back to one requirement id. If a test case can't name the single
   objective it verifies, split it.
2. Steps are `{ action, data, result }` triples, matching Xray's manual
   step format exactly (`data/test-design.json` models this shape). `data`
   is `"-"` when the action needs no concrete input value — never leave it
   out of the object, an Xray import expects the column to exist.
3. Priority is assigned from business impact, not gut feel: `Critical` for
   anything protecting a rule in `wiki/business_domain.md`'s tenant-isolation
   class, `High` for core flow-blocking rules, `Medium`/`Low` otherwise.
4. `test_type` is `Manual` unless the objective is already expressed as a
   Gherkin scenario reused in automation, in which case use `Cucumber`.
5. Track `automation_status` and `automated_by` honestly. A test case
   pointing at a real file under `src/tests/` or `golden_dataset/clean/` is
   `Automated`; everything else is `Not yet automated`. Don't mark
   something automated because it's *similar* to an automated case — link
   the actual file or leave it as manual.

## Output shape
A `test_cases` array in the shape `data/test-design.json` models — this is
what `xray-publisher` consumes to call the Xray MCP server's
`create_test_case` tool.
