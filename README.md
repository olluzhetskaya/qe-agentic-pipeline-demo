# QE Agentic Pipeline — L4 Lab Demo

A small, real example of the multi-agent pipeline described in
[`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`](docs/adr/ADR-014-multi-agent-test-generation-pipeline.md) —
built with Playwright + TypeScript, tool-agnostic agent/skill definitions,
and Cursor's real hook mechanism (no Python simulation, no vendor lock-in
on the agent/skill definitions).

Built for the L4 "design a multi-agent QE pipeline" module, in response to
learner feedback that the module gave a task description ("build an ADR")
with nothing to start from. This repo is that starting point.

## What's here

| Component | Location | What it is |
|---|---|---|
| Business-domain wiki | `wiki/business_domain.md` | Grounding context every agent reads before generating or reviewing a test |
| Skills | `.agents/skills/{pom-builder,spec-writer,locator-strategy,assertion-author,analysis-reporter}/SKILL.md` | Tool-agnostic Agent Skills — same location convention Cursor, Claude Code, and Codex all read |
| Agents | `.agents/agents/{spec-checker,test-generator,code-reviewer,pr-drafter}.md` | Tool-agnostic agent definitions — YAML frontmatter + system prompt |
| Hooks | `.cursor/hooks.json` + `.cursor/hooks/*.cjs` | Real Cursor hooks — `beforeShellExecution`, `afterFileEdit`, `stop`, per [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks). This is the one piece that's vendor-specific — hooks don't have a cross-tool standard yet. |
| POM | `src/pages/` | Real Playwright TypeScript Page Objects |
| Golden dataset | `golden_dataset/{clean,dirty}/` | Real `.spec.ts` calibration files the judge gate and the `stop` hook both check against |
| Lint | `eslint.config.mjs` | ESLint + `eslint-plugin-playwright`, scoped to `*.spec.ts` |
| Second static check | `.ast-grep/` | Independent structural rule, deliberately overlapping with ESLint |
| Sonar | `sonar-project.properties` | Config for CI; no live server in this demo |
| ADR | `docs/adr/ADR-014-*.md` | The actual deliverable format the L4 module asks for |

## Setup

```bash
npm install
```

This installs Playwright, TypeScript, ESLint + `eslint-plugin-playwright`,
and `@ast-grep/cli` as real dependencies — nothing here is mocked out. It
does **not** download Playwright's browser binaries (this demo never
launches a real browser; it only lints and typechecks), so no extra network
access is needed beyond npm itself.

## Run it

```bash
npm run lint          # ESLint (src + .cursor), including eslint-plugin-playwright's rules
npx tsc --noEmit       # typecheck
npx ast-grep scan --config .ast-grep/sgconfig.yml src/tests
```

`npm run lint` targets `src` and `.cursor` explicitly rather than the whole
repo — `golden_dataset/dirty/` is excluded from that default sweep on
purpose (see the dry-run section below), the way a real CI gate never lints
known-bad fixtures as if they were shipped code. Point ESLint at those files
directly and the rules still apply in full — nothing is silenced globally.

There is no orchestrator script to run the agent pipeline end-to-end from a
terminal — a live agent session (Cursor, or another `.agents/`-compatible
runtime) is the orchestrator, and the hooks only fire inside one. Open this
folder in Cursor and ask the main agent to work `data/ticket.json`; it will
delegate through `spec-checker` → `test-generator` → (`afterFileEdit` hook
fires automatically) → `code-reviewer` → `pr-drafter`, with `stop`
re-checking everything when the session ends.

### Dry-running the hooks outside a live agent session

The three hook scripts are plain Node.js that reads JSON from stdin and
writes JSON to stdout — you can exercise their real logic directly:

```bash
# enforcement: allowed vs. blocked shell commands
echo '{"command": "npx playwright test"}' | node .cursor/hooks/before-shell-execution.cjs
echo '{"command": "git merge feature/onboarding"}' | node .cursor/hooks/before-shell-execution.cjs

# deterministic gate: point it at a clean vs. dirty file
cp golden_dataset/clean/clean-01.spec.ts src/tests/tenant-onboarding-generated.spec.ts
echo '{"file_path": "src/tests/tenant-onboarding-generated.spec.ts"}' | node .cursor/hooks/after-file-edit.cjs

# session-end semantic re-check + draft PR gating
echo '{"conversation_id": "demo"}' | node .cursor/hooks/stop.cjs
cat docs/draft_pr.md   # only exists if the semantic gate passed
```

Swap in `golden_dataset/dirty/dirty-01.spec.ts` for the same steps and
watch `after-file-edit.cjs` fail it (both ESLint's `no-wait-for-timeout` and
the ast-grep rule catch the hardcoded wait). Then try
`golden_dataset/dirty/dirty-02.spec.ts` — it **passes** the deterministic
gate cleanly (nothing about a business-rule inversion is a lint error) and
only gets caught by `stop.cjs`'s semantic check. That gap is the entire
reason ADR-014 has two separate gates instead of one.

Every hook run appends to `traces/trace.jsonl`.

## What's real vs. what's a stand-in

| Piece | Real | Stand-in here |
|---|---|---|
| Wiki, skills, POM, golden dataset | ✅ | — |
| Agent definitions | ✅ tool-agnostic `.md` format | The *content* they'd generate is only produced when a live agent runtime actually runs them |
| Hooks | ✅ real Cursor hook events, real payload/response shape, verified by piping real JSON through them | — |
| ESLint + eslint-plugin-playwright | ✅ installed and run for real | — |
| ast-grep | ✅ installed and run for real | — |
| SonarQube | Config is real and CI-ready | No live Sonar server in this demo |
| Semantic gate | Real gate *structure*, calibrated against a real golden dataset | The judgment itself is a keyword-pattern check standing in for `code-reviewer`'s actual LLM reasoning, so the hook scripts are runnable and testable without a live agent session |
| Tracing | ✅ real structured event log | Langfuse → local `traces/trace.jsonl`; swap the `log()` function in the hook scripts for a real client to wire up production |
| Draft PR | ✅ enforced draft-only, for real (no `merge()` capability, no `terminal` tool, plus a shell-level block) | The PR itself is a local markdown file, not a real GitHub PR |

## Map back to the L4 course

- **Decision tree** → "Context" in the ADR: why this is an agent, not a
  scripted workflow.
- **Quality gates, deterministic vs. judge** → `afterFileEdit` hook
  (ESLint + ast-grep, Sonar in CI) vs. `code-reviewer` + `stop` hook,
  calibrated against `golden_dataset/`.
- **Reusable agent skills, published to AI Hub** → `.agents/skills/*/SKILL.md`.
- **ADR** → `docs/adr/ADR-014-*.md`.
- **Harness / enforcement vs. advisory** → `pr-drafter`'s
  `disallowedTools: terminal` (missing capability) plus
  `before-shell-execution.cjs` (explicit runtime block) — two independent
  layers, on purpose.
- **Observability / feedback controls** → `traces/trace.jsonl`.
- **Economics** → "Economics" section in the ADR.

## What's intentionally small

One page object, one ticket, four golden-dataset files, three hooks. Extend
it the same way you'd extend a real pipeline: more agents, a bigger golden
dataset, a real Langfuse client swapped into the `log()` calls, a live
Sonar server in CI.
