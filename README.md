# QE Agentic Pipeline — L4 Lab Demo (Cursor-native)

A small, real example of the multi-agent pipeline described in
[`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`](docs/adr/ADR-014-multi-agent-test-generation-pipeline.md) —
built with Cursor's actual subagent, skill, and hook primitives, not a
Python simulation of them.

Built for the L4 "design a multi-agent QE pipeline" module, in response to
learner feedback that the module gave a task description ("build an ADR")
with nothing to start from. This repo is that starting point.

## What's here

| Component | Location | What it is |
|---|---|---|
| Business-domain wiki | `wiki/business_domain.md` | Grounding context every agent reads before generating or reviewing a test |
| Skills | `.cursor/skills/{pom-builder,spec-writer,locator-strategy,assertion-author,analysis-reporter}/SKILL.md` | Real Cursor Skills (Agent Skills open standard) — same format used elsewhere in this org's skill library |
| Subagents | `.cursor/agents/{spec-checker,test-generator,code-reviewer,pr-drafter}.md` | Real Cursor subagents — YAML frontmatter + system prompt, per [cursor.com/docs/subagents](https://cursor.com/docs/subagents) |
| Hooks | `.cursor/hooks.json` + `.cursor/hooks/*.py` | Real Cursor hooks — `beforeShellExecution`, `afterFileEdit`, `stop`, per [cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks) |
| POM | `src/pages/` | Real Playwright Python Page Objects |
| Golden dataset | `golden_dataset/{clean,dirty}/` | Real calibration files the judge gate and the `stop` hook both check against |
| ADR | `docs/adr/ADR-014-*.md` | The actual deliverable format the L4 module asks for |

## How to actually run this

Open the folder in Cursor. There is no orchestrator script to run from a
terminal — Cursor's agent *is* the orchestrator, and the subagents /
hooks only do anything inside a live Cursor session. Ask the main agent to
work a ticket (e.g. paste `data/ticket.json`'s contents, or reference it),
and it will delegate through `@spec-checker` → `@test-generator` →
(`afterFileEdit` hook fires automatically) → `@code-reviewer` →
`@pr-drafter`, with the `stop` hook re-checking everything when the
session ends.

### Dry-running the hooks outside Cursor

The three hook scripts are plain Python that reads JSON from stdin and
writes JSON to stdout — you can exercise their logic directly, without
Cursor, to see exactly what they do:

```bash
# enforcement: allowed vs. blocked shell commands
echo '{"command": "pytest src/tests/"}' | python3 .cursor/hooks/before_shell_execution.py
echo '{"command": "git merge feature/onboarding"}' | python3 .cursor/hooks/before_shell_execution.py

# deterministic gate: point it at a clean vs. dirty file
cp golden_dataset/clean/clean_01.py src/tests/test_tenant_onboarding_generated.py
echo '{"file_path": "src/tests/test_tenant_onboarding_generated.py"}' | python3 .cursor/hooks/after_file_edit.py

# session-end semantic re-check + draft PR gating
echo '{"conversation_id": "demo", "hook_event_name": "stop"}' | python3 .cursor/hooks/stop.py
cat docs/draft_pr.md   # only exists if the semantic gate passed
```

Swap in `golden_dataset/dirty/dirty_01.py` for the same steps and watch
`after_file_edit.py` pass it (a bare `time.sleep()` isn't a lint error) while
`stop.py` fails it — the exact reason ADR-014 has two separate gates
instead of one.

Every hook run appends to `traces/trace.jsonl` — open it after a dry run to
see the full event log this stands in for Langfuse.

## What's real vs. what's a stand-in

| Piece | Real | Stand-in here |
|---|---|---|
| Wiki, skills, POM, golden dataset | ✅ | — |
| Subagent definitions | ✅ real Cursor `.md` format | The *content* they'd generate is only produced when Cursor actually runs them |
| Hooks | ✅ real Cursor hook events, real payload/response shape | — |
| Deterministic gate | ✅ ruff runs for real if installed | ast-grep degrades to a labeled skip if not installed |
| Semantic gate | Real gate *structure*, calibrated against a real golden dataset | The judgment itself is a keyword-pattern check standing in for `@code-reviewer`'s actual LLM reasoning, so the hook scripts are runnable and testable outside a live Cursor session |
| Tracing | ✅ real structured event log | Langfuse → local `traces/trace.jsonl`; swap the `log()` function in the hook scripts for a real client to wire up production |
| Draft PR | ✅ enforced draft-only, for real (no `merge()` capability, no `terminal` tool, plus a shell-level block) | The PR itself is a local markdown file, not a real GitHub PR |

## Map back to the L4 course

- **Decision tree** → "Context" in the ADR: why this is an agent, not a
  scripted workflow.
- **Quality gates, deterministic vs. judge** → `afterFileEdit` hook
  (deterministic) vs. `@code-reviewer` + `stop` hook (judge), calibrated
  against `golden_dataset/`.
- **Reusable agent skills, published to AI Hub** → `.cursor/skills/*/SKILL.md`.
- **ADR** → `docs/adr/ADR-014-*.md`.
- **Harness / enforcement vs. advisory** → `pr-drafter`'s
  `disallowedTools: terminal` (missing capability) plus
  `before_shell_execution.py` (explicit runtime block) — two independent
  layers, on purpose.
- **Observability / feedback controls** → `traces/trace.jsonl`.
- **Economics** → "Economics" section in the ADR.

## What's intentionally small

One page object, one ticket, four golden-dataset files, three hooks. Extend
it the same way you'd extend a real pipeline: more subagents, a bigger
golden dataset, a real Langfuse client swapped into the `log()` calls.
