# ADR-014: Multi-Agent Test Generation Pipeline — Kelly Benefits Platform 2.0

**Status:** Accepted

## Context

Manual test authoring for new HCM tenant-onboarding flows was the coverage
bottleneck — QC engineers spent ~60% of sprint capacity writing repetitive
Playwright specs instead of exploratory testing. Spec quality was
inconsistent across engineers.

Decision: apply the call/workflow/agent decision tree — this is a
multi-step task with variable input (a ticket + business-domain context) and
no single deterministic transformation, so it qualifies as an **agent**, not
a scripted workflow.

## Decision — Pipeline design

Built on tool-agnostic agent/skill definitions plus one vendor's hook
mechanism — no custom orchestrator script. The main agent is the
orchestrator; it delegates to four agents, in order, and two hooks fire
automatically around them.

| Phase | Component | Location | Output |
|---|---|---|---|
| 1. Context grounding | `spec-checker` agent | `.agents/agents/spec-checker.md` | Structured acceptance criteria + wiki grounding |
| 2. Test generation | `test-generator` agent | `.agents/agents/test-generator.md`, applying `.agents/skills/{pom-builder,spec-writer,locator-strategy,assertion-author}` | Draft `.spec.ts` file + POM usage |
| 3. Static validation | `afterFileEdit` hook | `.cursor/hooks/after-file-edit.cjs` (ESLint w/ `eslint-plugin-playwright`, ast-grep, SonarQube) | PASS/FAIL, blocking, runs automatically on write |
| 4. Semantic validation | `code-reviewer` agent | `.agents/agents/code-reviewer.md` | Judge verdict + findings |
| 5. PR + trace | `pr-drafter` agent + `stop` hook | `.agents/agents/pr-drafter.md`, `.cursor/hooks/stop.cjs` | Draft PR (`docs/draft_pr.md`) + full trace |

`.agents/` is deliberately not `.cursor/` — it's the shared, tool-agnostic
location the Agent Skills convention and several agent runtimes (Cursor,
Claude Code, Codex) read from, so these definitions aren't locked to one
vendor's tool. Hooks stay under `.cursor/` because hook execution is
currently a Cursor-specific mechanism with no equivalent cross-tool standard
yet — if that changes, this is the one piece that would move.

## Validation gates

- **Deterministic gate** (Phase 3, `afterFileEdit` hook): three independent
  static tools, all blocking, no override —
  - **ESLint** with `eslint-plugin-playwright`'s recommended rule set
    (`no-wait-for-timeout`, `expect-expect`, `missing-playwright-await`,
    `no-conditional-expect`, `no-raw-locators`), scoped to `*.spec.ts` files
    via `eslint.config.mjs`.
  - **ast-grep**, a second, independent check for the same hardcoded-wait
    pattern (`.ast-grep/rules/no-hardcoded-wait.yml`) — deliberately
    overlapping with ESLint rather than replacing it, mirroring a real
    multi-tool static-analysis setup where no single linter is trusted alone.
  - **SonarQube** (`sonar-project.properties`) — wired for CI; this demo
    doesn't run a live Sonar server, so it's config-only here.
  Classified deterministic because these are syntactic/structural rule
  checks, not judgment calls. Fires automatically the moment a file lands
  in `src/tests/`, so it doesn't depend on an agent remembering to run it.
- **Judge gate** (Phase 4, `code-reviewer` + re-checked by the `stop` hook):
  scores the generated test against a clean/dirty golden dataset
  (`golden_dataset/clean/`, `golden_dataset/dirty/`), checking correctness
  and alignment with the business-domain wiki — not "does it compile," but
  "is this testing the right thing." Classified judge because the verdict
  requires quality judgment a static rule can't express. Proven in practice:
  `golden_dataset/dirty/dirty-02.spec.ts` inverts a business rule and passes
  **both** ESLint and ast-grep cleanly — exactly why a semantic gate exists
  on top of static analysis, not instead of it.

## Human intervention points

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
task.

## Economics

~40 token-equivalent-minutes per generated spec vs. ~35 minutes of manual
authoring. Net positive only after the golden dataset stabilized — the
first two calibration cycles ran at breakeven while `code-reviewer`'s
judgment was being tuned against real dirty examples.

## Consequences

QC engineer time shifts from spec-writing to golden-dataset maintenance,
skill-library upkeep, and gate-failure triage using the trace file. This is
the exact skill set the Validation Engineer Transformation Program's
Playwright/TypeScript track builds toward.
