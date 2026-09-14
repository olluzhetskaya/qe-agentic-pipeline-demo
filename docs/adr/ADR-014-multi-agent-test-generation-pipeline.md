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
judgment-heavy, mostly-manual discipline that benefits from **skills** on
the main agent plus human gates, producing a reviewed artifact (Xray test
cases). Test generation from an already-designed case is a mechanical
multi-step playbook (`test-generation` skill), not a second mind.
**Isolated agents** are reserved for judges (fresh context) and
write-capability sinks (Xray MCP, draft-only PR). Both stages stay; neither
skips the other.

## Decision — Pipeline design

Built on tool-agnostic agent/skill definitions plus one vendor's hook
mechanism — no custom orchestrator script. The main agent is the
coordinator: it runs sequential skills in-session and spawns the isolated
agents. Subagents return a verdict to that parent; they do not route. Four
**isolated agents** exist only where a fresh window or a narrower tool set
is the point: the two judges, Xray publish, and PR draft. The live graph
lives in `README.md`. The e2e runbook is the slash command `/qe-pipeline`
(`.cursor/commands/qe-pipeline.md`) — `AGENTS.md` is standing constraints
only, because it is always attached to chat.

**Stage 0 — Manual: requirement to Xray**

| Phase | Component | Location | Output |
|---|---|---|---|
| 0a. Requirement analysis | `requirements-analysis` skill | `.agents/skills/requirements-analysis/SKILL.md` | `data/requirement.json` — ACs with `type` / `grade` / `confidence`, `wiki_refs` |
| 0b. Test objectives | `test-objectives` skill | `.agents/skills/test-objectives/SKILL.md` | Objectives with `covers_ac` + `wiki_rule` (always a human gate) |
| 0c. Test case design | `test-case-design` skill | `.agents/skills/test-case-design/SKILL.md` | `data/test-design.json` — Xray `{ action, data, result }` cases with `covers_ac` |
| 0 judge | `test-design-reviewer` **agent** | `.agents/agents/test-design-reviewer.md` | PASS summary or FAIL back to 0c |
| 0d. Publish to Xray | `xray-publisher` **agent** | `.agents/agents/xray-publisher.md` | Xray Test issues, linked to the requirement |

This stage is deliberately not automated end-to-end. `xray-publisher`
proposes each Xray issue and waits for explicit confirmation before calling
`create_test_case` — the same draft-then-confirm principle Stage 1 applies
to merges, applied here to Jira issue creation.

**Stage 1 — Automated: design to code**

| Phase | Component | Location | Output |
|---|---|---|---|
| 1. Test generation | `test-generation` skill | `.agents/skills/test-generation/SKILL.md` (from the test-design artifact; applies data-layer, explore-browser, locator-strategy, pom-builder, assertion-author) | Draft `.spec.ts` file + POM usage |
| 2. Static + quality validation | `afterFileEdit` + git gates | ESLint, ast-grep, `src/validation/` (config/design/data/**quality**) | Immediate PASS/FAIL on write; quality is per-`test()` wiki inversion, AC grades, failure-modes |
| 3. Semantic validation | `code-reviewer` **agent** | `.agents/agents/code-reviewer.md` | Judge verdict + findings |
| 4. PR + trace | `pr-drafter` **agent** + `stop` hook | `.agents/agents/pr-drafter.md`, `src/observability/stop.ts` | Draft PR (`out/draft_pr.md`) + full trace |

Not every wiki rule has to become a case on every story, and not every
manual case has to be automated. `data/test-design.json` tracks
`automation_status` per case via `automated_by` (produced specs under
`src/tests/` only). The current KB-4821 artifact has one `Automated` case
(`TC-2` → `src/tests/tenant-onboarding.spec.ts`) and two `Not yet automated`
cases (`TC-1`, `TC-3`) — `golden_dataset/clean` calibrates reviewers and
must not appear in `automated_by`. Starter-tier plan-count (`plan-tier-limits`)
is a wiki rule and a golden example (`clean-04.spec.ts`), not a case on this
story — the design gate requires each objective's `wiki_rule` to be one of
the requirement's `wiki_refs`, not an objective for every file in `wiki/`.
A later story can still add that case, or mark one `Not yet automated`; the
pipeline must not silently drop uncovered cases from the artifact.

`.agents/` is deliberately not `.cursor/` — it's the shared, tool-agnostic
location the Agent Skills convention and several agent runtimes (Cursor,
Claude Code, Codex) read from, so these definitions aren't locked to one
vendor's tool. Hooks stay under `.cursor/` because hook execution is
currently a Cursor-specific mechanism with no equivalent cross-tool standard
yet — if that changes, this is the one piece that would move.

## Validation gates

- **Deterministic gate** (`afterFileEdit` hook): two independent
  source-analysis passes plus repository relationship validators —
  - **ESLint**, bundling two plugins in one pass: `eslint-plugin-playwright`
    (`no-wait-for-timeout`, `expect-expect`, `missing-playwright-await`,
    `no-conditional-expect`, `no-raw-locators`, `prefer-web-first-assertions`)
    and `eslint-plugin-sonarjs` — Sonar's own JS/TS rule set (279 rules),
    exposed as a real, locally-runnable ESLint plugin, no server required.
    Scoped to `*.spec.ts` via `eslint.config.mjs`.
  - **ast-grep**, for patterns ESLint does not own: no Playwright `page`
    fixture in a spec (`.ast-grep/rules/no-page-in-spec.yml`), no
    boolean-returning POM state wrappers, and a coarser boolean-literal
    assertion rule (`.ast-grep/rules/no-boolean-literal-assertion.yml`)
    that overlaps `prefer-web-first-assertions` on purpose. Hardcoded
    `waitForTimeout` stays on ESLint (`playwright/no-wait-for-timeout`)
    plus `sonarjs/no-fixed-wait-in-tests` — no third ast-grep copy.
  `sonar-project.properties` is separate from this: it configures a live
  SonarQube/SonarCloud server for CI, which adds cross-run tracking and a
  quality-gate history that a local ESLint plugin doesn't provide on its
  own — this demo's `afterFileEdit` hook exercises the real local rule
  coverage, not the server-side scan.
  Classified deterministic because these are syntactic/structural rule
  checks, not judgment calls. Fires automatically the moment a file lands
  in a watched path, so it doesn't depend on an agent remembering to run it.
  `afterFileEdit` reports findings but cannot undo an edit; `failClosed`
  plus a non-zero exit makes a FAIL visible to the agent. Husky
  pre-commit/pre-push and `npm run validate` are the enforcing boundaries
  for git. `afterFileEdit` also watches `src/validation/` and
  `src/observability/`; `data/harness-checksum.json` must match those trees.
- **Repository relationship gates** (`src/validation/`), split by direction
  rather than duplicating static rules:
  - `config-gates.ts`: isolated-agent capabilities, Cursor hook wiring
    (`failClosed` on `beforeShellExecution`, `beforeMCPExecution`,
    `afterFileEdit`, and `stop`),
    `data/run-state.json`, and the harness checksum.
  - `design-gates.ts`: wiki format plus requirement → objective → case →
    automation traceability (`automated_by` under `src/tests/`; `xray_key`
    required once run-state reaches `1a_generation`).
  - `data-gates.ts`: structural fixture contracts only—location under
    `src/data/`, readonly schemas, typed `Record<string, Schema>` catalogs,
    and the `@fixtures` export boundary. Duplicate values, `let` vs `const`,
    and other generic smells stay with ESLint / sonarjs. It does not execute
    tenant, tier, plan, or lifecycle policy.
  - `quality-gates.ts`: persisted AC grades, wiki failure-mode coverage on
    designed cases, per-`test()` spec semantics (tautology, the wiki's
    `Assertion:` contracts, fixture scalar literals discovered from typed
    catalogs), and a golden lock that
    `dirty-02` still fails an inversion contract. Enforced by
    `afterFileEdit`, `npm run validate`, Husky, and `stop` (no draft PR on
    FAIL). File-level regex is not enough: a good `test()` in the same spec
    must not hide a bad one.
  - `verdict-gates.ts`: each isolated judge writes its own typed file under
    `data/verdicts/`. The gate validates verdict/finding enums, all confidence
    values, rationale, target, filename, and target SHA-256. The coordinator
    routes only from `verdict:check`; `stop` also requires PASS files before
    writing `out/draft_pr.md`.
  - `wiki-rules.ts`: the single parser for `wiki/`. Rule slugs, failure
    phrases, assertion contracts, and sensitive paths are declarations in
    `wiki/`, so a rule change is reviewable by someone who does not read
    TypeScript. Business cardinality remains expected behavior in the wiki
    and test design; it is not interpreted by the data gate.

The optional `review-ui/` is a read-only projection for human inspection. It
regenerates a snapshot from the requirement/design artifacts, wiki parsers,
deterministic gates, and fixture resolver before serving; it cannot approve or
change a checkpoint. The projection uses maintained packages (`dot-prop`,
`@xyflow/react`, `react-json-view-lite`) while retaining the gate's own
allowlist of valid fixture handles.
- **Judge gate** (`code-reviewer`, plus `test-design-reviewer` on Stage 0):
  scores artifacts against the wiki and `golden_dataset/` for questions a
  regex still cannot express — technique fit, invented scope, “does this
  case actually exercise the failure mode.” Classified judge because the
  verdict requires quality judgment. The judge writes the JSON artifact
  directly from a precomputed `REVIEW_CONTEXT`; prose is only its human
  rendering. Files under `data/verdicts/` bind to the target SHA-256, and
  a chat PASS is not enforceable.
  Proven in practice:
  `golden_dataset/dirty/dirty-02.spec.ts` uses a syntactically
  *correct* web-first assertion (`toBeEnabled()`) but calls it with the
  wrong precondition, inverting a business rule — overlapping wait/boolean
  linters pass it. Quality-gates encode that known inversion; the isolated
  judge remains the catch for the next inversion that is not yet a pattern.

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

- `xray-publisher` never calls `create_test_case` without first fetching
  the requirement catalogue once, diffing it locally against
  `data/test-design.json`, and proposing only the missing issues as one
  list. `beforeMCPExecution` then returns `ask` for the
  exact Xray write call. The hook is fail-closed, so a crash or invalid
  response blocks the call. Clear Xray reads proceed without a prompt;
  unknown Xray tools require approval.
  This gate is local only. Cloud agents do not run `beforeMCPExecution` or
  `sessionStart`. Do not provision Xray credentials there. `xray-publisher`
  refuses unless `.cursor/gate-status.json` records `"mcp_gate": true`.
- Output is draft-PR-only. `pr-drafter`'s frontmatter sets
  `disallowedTools: terminal` — the agent has no shell access, so a merge
  command isn't a capability it has, not just an instruction it's told to
  avoid.
- `src/observability/before-shell-execution.ts` (`beforeShellExecution` hook)
  is defense-in-depth: it pattern-matches merge, rebase, force-push, push
  to main/master/release, and `gh` merge helpers. It is not a complete
  sandbox (aliases and indirection can bypass regex). The capability
  boundary is `pr-drafter`'s `disallowedTools: terminal`.
- Anything touching a domain declared in `wiki/sensitive_domains.md`
  (currently `payroll` and `pii`) is flagged by
  `src/observability/after-file-edit.ts` for mandatory manual review
  regardless of gate result. The hook matches path segments against the wiki
  slugs, so widening the scope is a wiki edit, not a code change.

## Observability

Hooks emit spans, generations, and scores to Langfuse via
`src/observability/langfuse-client.ts`. `afterAgentResponse` attaches native
`usageDetails` and `costDetails` on the `agent-response` generation (Langfuse
→ Analytics → Costs). All events in a Cursor session share
one trace keyed on `conversation_id` (supplied by Cursor in every hook payload).
Set `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` in `.env`; without them the
observability calls are a no-op. How to estimate a run is in the README
Economics section. When Langfuse is configured, a human can reconstruct
what the hooks recorded without having watched it live. Stage 0's
artifact traceability remains readable without Langfuse:
`requirement_id` → `linked_objective` → `automated_by`.

## Economics

**Unmeasured in this demo.** There is no timed QC study, no token-minute
log, and no calibration-cycle ledger in the repo. Estimate a live run with
the method in the README Economics section (count isolated calls first;
Langfuse `costDetails` is coordinator-only; `real_conversation_cost_cents`
checks the estimate against Cursor’s bill when credentials exist).

Do not treat these leftover figures as results: ~40 token-equivalent-minutes
per spec vs ~35 minutes of manual authoring; two “breakeven” calibration
cycles; ~60% of sprint capacity on Playwright specs (Context). They have
no source in `traces/`, Langfuse, or an appendix. Stage 0’s value —
catching a wrong or ambiguous requirement before code exists — is still a
**qualitative** claim: expensive to fake as cents, cheap compared to
automating the wrong behavior, but not a measured ROI here.

## Consequences

QC engineer time shifts from spec-writing to test-design review,
golden-dataset maintenance, skill-library upkeep, and gate-failure triage
using the trace file. This is the exact skill set the Validation Engineer
Transformation Program's Playwright/TypeScript track builds toward — and,
on the manual side, the requirement-analysis and test-design discipline
that program's "day in the life" framing already assumed was happening,
made explicit and traceable here.
