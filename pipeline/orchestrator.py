"""
orchestrator — runs the ADR-014 pipeline end to end.

    python -m pipeline.orchestrator run                  # clean generation, should PASS
    python -m pipeline.orchestrator run --inject-violation   # should FAIL at the semantic gate
    python -m pipeline.orchestrator calibrate            # sanity-checks the gate against golden_dataset/

This file is the thing a learner reads to see the whole ADR as running code:
5 phases, 2 gates (1 deterministic, 1 judge), 2 enforcement hooks, full trace.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.agents import code_reviewer, pr_agent, spec_checker, test_generator
from pipeline.gates import static_checks
from pipeline.hooks.trace_hook import log_event, reset_trace

GOLDEN_CLEAN = Path(__file__).resolve().parents[1] / "golden_dataset" / "clean"
GOLDEN_DIRTY = Path(__file__).resolve().parents[1] / "golden_dataset" / "dirty"


def run_pipeline(inject_violation: bool = False) -> int:
    reset_trace()
    print(f"\n== ADR-014 pipeline run (inject_violation={inject_violation}) ==\n")

    spec = spec_checker.run()
    print(f"[1/5] spec_checker      -> {len(spec['criteria'])} criteria "
          f"({sum(1 for c in spec['criteria'] if c['type'] == 'judge')} judge-classified)")

    generated_path = test_generator.run(spec, inject_violation=inject_violation)
    print(f"[2/5] test_generator    -> wrote {generated_path}")

    static_result = static_checks.run(generated_path)
    print(f"[3/5] static_checks     -> {static_result['verdict']} "
          f"({', '.join(c['tool'] + ':' + c['status'] for c in static_result['checks'])})")

    review_result = code_reviewer.run(generated_path)
    print(f"[4/5] code_reviewer     -> {review_result['verdict']} "
          f"({review_result['reviewer_note']})")
    if review_result["findings"]:
        for f in review_result["findings"]:
            print(f"        finding: {f}")

    if static_result["verdict"] == "FAIL" or review_result["verdict"] == "FAIL":
        log_event("orchestrator", "blocked", {
            "reason": "a gate failed, pipeline stops before PR phase",
            "static": static_result["verdict"],
            "semantic": review_result["verdict"],
        })
        print("\n[5/5] pr_agent          -> SKIPPED (a gate failed, nothing gets a PR)")
        print("\nRESULT: BLOCKED. See traces/trace.jsonl for the full reasoning trace.\n")
        return 1

    pr_payload = pr_agent.run(generated_path, review_result, spec)
    print(f"[5/5] pr_agent          -> draft PR written to docs/draft_pr.md "
          f"(status={pr_payload['status']}, manual_review={pr_payload['requires_manual_review']})")
    print("\nRESULT: DRAFT PR READY FOR HUMAN MERGE. See traces/trace.jsonl for the full reasoning trace.\n")
    return 0


def calibrate() -> int:
    """
    Proves the semantic gate actually discriminates clean from dirty before
    anyone trusts it on real generated output — this is what 'gate every
    pipeline on CI runs' means in practice, not just a slide claim.
    """
    print("\n== Calibrating code_reviewer against golden_dataset/ ==\n")
    failures = 0

    for f in sorted(GOLDEN_CLEAN.glob("*.py")):
        result = code_reviewer.run(str(f))
        ok = result["verdict"] == "PASS"
        print(f"  clean/{f.name:20s} -> {result['verdict']:4s} {'OK' if ok else 'MISCALIBRATED'}")
        failures += 0 if ok else 1

    for f in sorted(GOLDEN_DIRTY.glob("*.py")):
        result = code_reviewer.run(str(f))
        ok = result["verdict"] == "FAIL"
        print(f"  dirty/{f.name:20s} -> {result['verdict']:4s} {'OK' if ok else 'MISCALIBRATED'}")
        failures += 0 if ok else 1

    print(f"\n{'PASS' if failures == 0 else 'FAIL'}: {failures} miscalibrated case(s).\n")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    run_cmd = sub.add_parser("run")
    run_cmd.add_argument("--inject-violation", action="store_true")
    sub.add_parser("calibrate")

    args = parser.parse_args()
    if args.command == "run":
        sys.exit(run_pipeline(inject_violation=args.inject_violation))
    elif args.command == "calibrate":
        sys.exit(calibrate())
