"""
trace_hook — stands in for Langfuse (or any tracing backend) in this demo.

In production this would be an actual Langfuse client call. Here it appends
one JSON line per event to traces/trace.jsonl so the demo is runnable without
external services, while keeping the exact thing the L4 course cares about:
every hook firing is observable after the fact, not just inferred from the
final PASS/FAIL.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

TRACE_FILE = Path(__file__).resolve().parents[2] / "traces" / "trace.jsonl"


def log_event(phase: str, event_type: str, detail: dict) -> None:
    """
    phase: which pipeline phase emitted this (spec_checker, test_generator, ...)
    event_type: pre_tool_call | post_tool_call | gate_result | pr_created | blocked
    detail: free-form payload — kept small and readable on purpose (see
            analysis_reporter skill: a human should be able to scan this).
    """
    TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "phase": phase,
        "event_type": event_type,
        "detail": detail,
    }
    with TRACE_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def reset_trace() -> None:
    """Demo convenience only — production tracing is append-only, never reset."""
    if TRACE_FILE.exists():
        TRACE_FILE.unlink()
