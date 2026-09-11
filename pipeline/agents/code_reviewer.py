"""
code_reviewer — Phase 4, the semantic/judge gate.

Real version: an LLM call that reads the generated diff plus wiki context
and the golden dataset, and returns a verdict with reasoning — genuinely a
judgment call, which is why the L4 course classifies this a "judge" gate,
not "deterministic" (contrast pipeline/gates/static_checks.py, which is a
pure rule check with no judgment involved).

Demo version: a small pattern-matcher standing in for the LLM judgment, using
the exact patterns golden_dataset/dirty/*.py were built to represent. This
keeps the *gate structure* real (judge gate, calibrated against clean/dirty
examples, returns verdict + reasoning) while the *judgment mechanism* is a
stand-in.
"""
from __future__ import annotations

from pathlib import Path

from ..hooks.trace_hook import log_event

VIOLATION_PATTERNS = {
    "time.sleep(": "Hardcoded sleep instead of an explicit Playwright wait "
                    "(assertion_author skill, rule 3).",
    "assert onboarding.page.url": "Not a real assertion — checks that the page "
                                   "has a URL, not the acceptance criterion.",
    "is_finish_enabled() is True": "Possible business-rule inversion — cross-check "
                                    "against wiki rule 1 (submission gating) before passing.",
}


def run(generated_file_path: str) -> dict:
    code = Path(generated_file_path).read_text()

    log_event("code_reviewer", "pre_tool_call", {
        "tool": "semantic_review",
        "path": generated_file_path,
        "golden_dataset_size": {"clean": 2, "dirty": 2},
    })

    findings = [
        message for pattern, message in VIOLATION_PATTERNS.items() if pattern in code
    ]
    verdict = "FAIL" if findings else "PASS"

    result = {
        "verdict": verdict,
        "findings": findings,
        "reviewer_note": (
            "Matches known-good pattern from golden_dataset/clean/."
            if verdict == "PASS"
            else "Matches a seeded violation pattern from golden_dataset/dirty/ — "
                 "do not merge without a human fixing this first."
        ),
    }

    log_event("code_reviewer", "gate_result", result)
    return result
