#!/usr/bin/env python3
"""
Cursor hook: stop
Fires when the agent session ends. Runs a lightweight, independent version
of the semantic/judge gate against the last generated test file, then
writes — or refuses to write — the draft PR, and appends a session summary
to the trace log either way.

This is where the L3 course's "grade asynchronously from the artifact alone"
habit becomes literal: whoever reads traces/trace.jsonl afterward doesn't
need to have watched the session happen.

Payload/response shape follows the documented pattern at
https://cursor.com/docs/agent/hooks — re-check field names there if
Cursor's schema has moved since this was written.
"""
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TRACE_FILE = REPO_ROOT / "traces" / "trace.jsonl"
GENERATED_TEST = REPO_ROOT / "src" / "tests" / "test_tenant_onboarding_generated.py"
DRAFT_PR = REPO_ROOT / "docs" / "draft_pr.md"

# Same seeded patterns as golden_dataset/dirty/*.py — kept in sync so this
# independent check and code-reviewer's judgment are calibrated the same way.
VIOLATION_PATTERNS = {
    "time.sleep(": "Hardcoded sleep instead of an explicit Playwright wait.",
    "assert onboarding.page.url": "Not a real assertion tied to an acceptance criterion.",
    "is_finish_enabled() is True": "Possible inversion of business rule 1 (submission gating) — cross-check wiki.",
}


def log(event_type: str, detail: dict) -> None:
    TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with TRACE_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "hook": "stop",
            "event_type": event_type,
            "detail": detail,
        }) + "\n")


def main() -> None:
    try:
        json.load(sys.stdin)  # conversation_id, loop_count, etc. — unused in this demo
    except json.JSONDecodeError:
        pass

    if not GENERATED_TEST.exists():
        log("no_op", {"reason": "no generated test file found this session"})
        print(json.dumps({}))
        return

    code = GENERATED_TEST.read_text()
    findings = [msg for pattern, msg in VIOLATION_PATTERNS.items() if pattern in code]
    verdict = "FAIL" if findings else "PASS"

    log("gate_result", {"phase": "semantic_review", "verdict": verdict, "findings": findings})

    if verdict == "FAIL":
        log("blocked", {"reason": "semantic gate failed at session end, no PR drafted"})
        print(json.dumps({
            "agentMessage": (
                f"Session ended with a FAILING semantic gate ({len(findings)} finding(s)). "
                "No draft PR was written. See traces/trace.jsonl for detail."
            )
        }))
        return

    DRAFT_PR.write_text(
        "# Draft PR — agent-generated test\n\n"
        "**Status:** DRAFT (no agent in this pipeline can set any other status)\n"
        f"**File:** `{GENERATED_TEST.relative_to(REPO_ROOT)}`\n"
        "**Semantic gate:** PASS\n\n"
        "A human must open and merge this manually.\n"
    )
    log("pr_created", {"file": str(GENERATED_TEST.relative_to(REPO_ROOT)), "status": "draft"})
    print(json.dumps({
        "agentMessage": "Semantic gate PASS. Draft PR written to docs/draft_pr.md — a human merges it."
    }))


if __name__ == "__main__":
    main()
