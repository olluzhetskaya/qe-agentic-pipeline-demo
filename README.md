# QE Agentic Pipeline — L4 Lab Demo

A small, runnable example of the multi-agent pipeline described in
[`docs/adr/ADR-014-multi-agent-test-generation-pipeline.md`](docs/adr/ADR-014-multi-agent-test-generation-pipeline.md).

Built for the L4 "design a multi-agent QE pipeline" module, in response to
learner feedback that the module gave a task description ("build an ADR")
with nothing to start from. This repo is that starting point: a real ADR,
a real (small) codebase, and a runnable pipeline you can break on purpose
and watch the gates catch it.

## What's real vs. simulated

| Component | Real | Simulated for this demo |
|---|---|---|
| Wiki / business-domain grounding | ✅ actual markdown, actually read by the agent | — |
| Skills (`skills/*/SKILL.md`) | ✅ real skill files, real rules | — |
| POM (`src/pages/`) | ✅ real Playwright Python POM code | — |
| Golden dataset | ✅ real clean/dirty test files | — |
| Phase 1 (spec_checker) | Phase boundary + trace real | LLM call → direct file read + transform |
| Phase 2 (test_generator) | Phase boundary + trace real | LLM call → string template, with an `--inject-violation` switch |
| Phase 3 (static_checks) | ruff runs for real if installed | ast-grep / Sonar degrade to a labeled stub if not installed |
| Phase 4 (code_reviewer) | Gate structure + calibration against golden dataset is real | LLM judgment → pattern matcher tuned to the seeded violations |
| Phase 5 (pr_agent) | ✅ real: this agent has no `merge()` method, full stop | Draft PR is a local markdown file, not a real GitHub PR |
| Observability | ✅ real structured event log | Langfuse → local `traces/trace.jsonl` |

Swap any "simulated" row for the real thing on an actual project without
touching the pipeline's shape — that's the point of the phase boundaries.

## Run it

```bash
pip install -r requirements.txt

# Clean generation — should pass every gate and produce a draft PR
python -m pipeline.orchestrator run

# Same pipeline, but the generator injects the seeded violation —
# watch it get caught at the semantic gate and never reach pr_agent
python -m pipeline.orchestrator run --inject-violation

# Calibrate the judge gate against the golden dataset directly —
# proves it discriminates clean from dirty before you trust it on
# real generated output
python -m pipeline.orchestrator calibrate
```

Each run appends to `traces/trace.jsonl` — open it after a run to see the
full phase-by-phase reasoning trace (this is what "async review discipline"
from the L3 course looks like applied to a pipeline instead of a single task).

## Map back to the L4 course

- **Decision tree** → see "Context" in the ADR: why this is an agent, not a
  scripted workflow.
- **Quality gates, deterministic vs. judge** → `pipeline/gates/static_checks.py`
  (deterministic) vs. `pipeline/agents/code_reviewer.py` (judge), calibrated
  against `golden_dataset/`.
- **Reusable agent skills** → `skills/*/SKILL.md`, written in the same format
  used elsewhere in this org's skill library.
- **ADR** → `docs/adr/ADR-014-*.md`, the actual deliverable format.
- **Harness / enforcement vs. advisory** → `pipeline/hooks/enforcement.py`:
  notice the boundary is a missing capability (`pr_agent` can't merge),
  reinforced by an explicit guard — not a prompt asking nicely.
- **Observability / feedback controls** → `traces/trace.jsonl` via
  `pipeline/hooks/trace_hook.py`.
- **Economics** → see "Economics" section in the ADR.

## What's intentionally small

This is a lab demo, not a production framework — one page object, one
ticket, four golden-dataset files. The three static tools degrade gracefully
if not installed so the demo runs anywhere. Extend it (more pages, a bigger
golden dataset, a real Langfuse client) the same way you'd extend the real
pipeline on your own project.
