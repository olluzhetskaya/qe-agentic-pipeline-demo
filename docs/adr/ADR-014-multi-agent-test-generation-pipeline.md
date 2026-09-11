# ADR-014: Requirement-to-Automation Test Pipeline — Kelly Benefits Platform 2.0

**Status:** Accepted

## Context

Manual test authoring for new HCM tenant-onboarding flows was the coverage
bottleneck — QC engineers spent ~60% of sprint capacity writing repetitive
Playwright specs instead of exploratory testing. Spec quality was
inconsistent across engineers, and the manual test-design step (what should
be verified, in what order, at what priority) was happening informally or
not at all before code got written.

Decision: apply the call/workflow/agent decision tree to two different
things that got conflated before — requirement analysis / test design is a
judgment-heavy, mostly-manual discipline that benefits from agent
assistance but produces a human-reviewed artifact (Xray test cases), while
test generation from an already-designed case is a more mechanical,
multi-step task with variable input and no single deterministic
transformation, which qualifies as an **agent** in the stricter sense.
Both get their own phase; neither skips the other.

## Decision — Pipeline design

Built on tool-agnostic agent/skill definitions plus one vendor's hook
mechanism — no custom orchestrator script. The main agent is the
orchestrator; it delegates to seven agents across two stages, and two hooks
fire automatically around the automation stage.

**Stage 0 — Manual: requirement to Xray**

| Phase | Component | Location | Output |
|---|---|---|---|
| 0a. Requirement analysis | `requirements-analyst` agent | `.agents/agents/requirements-analyst.md` | Testable requirement statements, wiki-grounded |
| 0b/0c. Test objectives + design | `test-designer` agent | `.agents/agents/test-designer.md`, applying `.agents/skills/test-case-design` | `data/test-design.json` — Xray-shaped manual test cases |
| 0d. Publish to Xray | `xray-publisher` agent | `.agents/agents/xray-publisher.md`, via a connected Xray MCP server | Xray Test issues, linked to the requirement |

This stage is deliberately not automated end-to-end. `xray-publisher`
proposes each Xray issue and waits for explicit confirmation before calling
`create_test_case` — the same draft-then-confirm principle Stage 1 applies
to merges, applied here to Jira issue creation.

**Stage 1 — Automated: design to code**

| Phase | Component | Location | Output |
|---|---|---|---|
| 1. Context grounding | `spec-checker` agent | `.agents/agents/spec-checker.md` | Structured acceptance criteria + wiki grounding |
| 2. Test generation | `test-generator` agent | `.agents/agents/test-generator.md`, applying `.agents/skills/{pom-builder,spec-writer,locator-strategy,assertion-author}` | Draft `.spec.ts` file + POM usage |
| 3. Static validation | `afterFileEdit` hook | `.cursor/hooks/after-file-edit.cjs` (ESLint w/ `eslint-plugin-playwright` + `eslint-plugin-sonarjs`, ast-grep) | PASS/FAIL, blocking, runs automatically on write |
| 4. Semantic validation | `code-reviewer` agent | `.agents/agents/code-reviewer.md` | Judge verdict + findings |
| 5. PR + trace | `pr-drafter` agent + `stop` hook | `.agents/agents/pr-drafter.md`, `.cursor/hooks/stop.cjs` | Draft PR (`docs/draft_pr.md`) + full trace |

Not every manual test case is automated. `data/test-design.json` tracks
`automation_status` per case honestly: 3 of the 4 cases in this example are
`Automated` (each linked to a real file via `automated_by`); the fourth
(a Starter-tier plan-count limit) is `Not yet automated` — nothing in this
pipeline pretends otherwise or silently drops it from coverage tracking.

`.agents/` is deliberately not `.cursor/` — it's the shared, tool-agnostic
location the Agent Skills convention and several agent runtimes (Cursor,
Claude Code, Codex) read from, so these definitions aren't locked to one
vendor's tool. Hooks stay under `.cursor/` because hook execution is
currently a Cursor-specific mechanism with no equivalent cross-tool standard
yet — if that changes, this is the one piece that would move.

## Validation gates

- **Deterministic gate** (Phase 3, `afterFileEdit` hook): two independent
  tool passes, both blocking, no override —
  - **ESLint**, bundling two plugins in one pass: `eslint-plugin-playwright`
    (`no-wait-for-timeout`, `expect-expect`, `missing-playwright-await`,
    `no-conditional-expect`, `no-raw-locators`, `prefer-web-first-assertions`)
    and `eslint-plugin-sonarjs` — Sonar's own JS/TS rule set (279 rules),
    exposed as a real, locally-runnable ESLint plugin, no server required.
    Scoped to `*.spec.ts` via `eslint.config.mjs`.
  - **ast-grep**, a third, independent check for the same hardcoded-wait
    pattern (`.ast-grep/rules/no-hardcoded-wait.yml`), plus a second,
    coarser rule for boolean-literal assertions
    (`.ast-grep/rules/no-boolean-literal-assertion.yml`) — deliberately
    overlapping with the ESLint plugins rather than replacing them,
    mirroring a real multi-tool static-analysis setup where no single
    linter is trusted alone.
  `sonar-project.properties` is separate from this: it configures a live
  SonarQube/SonarCloud server for CI, which adds cross-run tracking and a
  quality-gate history that a local ESLint plugin doesn't provide on its
  own — this demo's `afterFileEdit` hook exercises the real local rule
  coverage, not the server-side scan.
  Classified deterministic because these are syntactic/structural rule
  checks, not judgment calls. Fires automatically the moment a file lands
  in `src/tests/`, so it doesn't depend on an agent remembering to run it.
- **Judge gate** (Phase 4, `code-reviewer` + re-checked by the `stop` hook):
  scores the generated test against a clean/dirty golden dataset
  (`golden_dataset/clean/`, `golden_dataset/dirty/`), checking correctness
  and alignment with the business-domain wiki — not "does it compile," but
  "is this testing the right thing." Classified judge because the verdict
  requires quality judgment a static rule can't express. Proven in
  practice: `golden_dataset/dirty/dirty-02.spec.ts` uses a syntactically
  *correct* web-first assertion (`toBeEnabled()`) but calls it with the
  wrong precondition, inverting a business rule — it passes ESLint,
  sonarjs, and ast-grep cleanly. Only a check that reads
  `wiki/business_domain.md` alongside the diff catches it. That gap is the
  entire justification for this gate existing separately from static
  analysis, not a stronger version of it.

### A real bug this dataset caught in itself

An earlier draft of `src/pages/onboarding-page.ts` wrapped the Finish
button's state in an `isFinishEnabled(): Promise<boolean>` method, and every
test asserted `expect(await onboarding.isFinishEnabled()).toBe(false)`.
That's exactly the anti-pattern `assertion-author` and `pom-builder` warn
against — and testing it against the real, installed
`eslint-plugin-playwright` proved something sharper than "it's bad style":
`playwright/prefer-web-first-assertions` **did not fire on it**. The rule
only matches a raw Playwright locator method call (`.isEnabled()` etc.)
appearing directly in the code; once that call is hidden one level behind a
custom Page Object method, the linter can't see the pattern at all. Wrapping
locator state in a boolean method doesn't just throw away Playwright's
auto-retry — it defeats static analysis too. `golden_dataset/dirty/dirty-03.spec.ts`
now calibrates this exact shape (a raw `.isEnabled()` call, asserted with
`.toBe(true)`, bypassing the Page Object entirely) so the gate has something
real to catch, and `onboarding-page.ts` now exposes `finishButton` as a
public `Locator` instead.

## Human intervention points

- `xray-publisher` never calls `create_test_case` without first proposing
  the exact issue content and getting explicit confirmation — the same
  principle as the two points below, applied to Jira issue creation instead
  of code.
- Output is draft-PR-only. `pr-drafter`'s frontmatter sets
  `disallowedTools: terminal` — the agent has no shell access, so a merge
  command isn't a capability it has, not just an instruction it's told to
  avoid.
- `.cursor/hooks/before-shell-execution.cjs` (`beforeShellExecution` hook)
  is a second, independent line of defense: it pattern-matches and blocks
  `git merge`, `git push ... main/master`, and `gh pr merge` for *any*
  agent that attempts them, regardless of tool configuration. This is the
  advisory-vs-enforcement distinction the L4 course draws — one is a
  missing capability, the other is a runtime block; both are present here
  on purpose.
- Anything touching payroll- or PII-adjacent test paths
  (`src/pages/payroll`, `src/tests/payroll`, `src/tests/pii`) is flagged by
  `after-file-edit.cjs` for mandatory manual review regardless of gate
  result.

## Observability

Every hook appends to `traces/trace.jsonl` — this stands in for Langfuse
(or any tracing backend) in this demo; swap the `log()` function in
`after-file-edit.cjs` and `stop.cjs` for a real Langfuse client call to wire
it up for production. A human can reconstruct exactly what happened in a
session without having watched it live — this is what makes the L3 course's
async review discipline possible applied to a pipeline instead of a single
task. Stage 0's traceability runs through `data/test-design.json` itself:
`requirement_id` → `linked_objective` → `automated_by`, readable without a
trace file at all.

## Economics

~40 token-equivalent-minutes per generated spec vs. ~35 minutes of manual
authoring, for Stage 1 alone. Stage 0 isn't measured the same way — its
value is catching a wrong or ambiguous requirement before any code exists,
which is expensive to price per-token but cheap compared to the cost of
automating the wrong behavior. Stage 1's net-positive number held only
after the golden dataset stabilized — the first two calibration cycles ran
at breakeven while `code-reviewer`'s judgment was being tuned against real
dirty examples.

## Consequences

QC engineer time shifts from spec-writing to test-design review,
golden-dataset maintenance, skill-library upkeep, and gate-failure triage
using the trace file. This is the exact skill set the Validation Engineer
Transformation Program's Playwright/TypeScript track builds toward — and,
on the manual side, the requirement-analysis and test-design discipline
that program's "day in the life" framing already assumed was happening,
made explicit and traceable here.
