#!/usr/bin/env python3
"""
Cursor hook: afterFileEdit
Fires after the agent edits/writes a file. This is ADR-014's Phase 3 (the
deterministic gate) running automatically the moment test-generator writes
a file, instead of waiting for a human — or a subagent — to remember to run
lint separately.

Only acts on files under src/tests/; everything else is a silent pass-through.

Payload/response shape follows the documented pattern at
https://cursor.com/docs/agent/hooks — re-check field names there (this demo
reads either `file_path` or `filePath`) if Cursor's schema has moved on.
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TRACE_FILE = REPO_ROOT / "traces" / "trace.jsonl"
PII_PREFIXES = ("src/pages/payroll", "src/tests/payroll", "src/tests/pii")


def log(event_type: str, detail: dict) -> None:
    TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with TRACE_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "hook": "afterFileEdit",
            "event_type": event_type,
            "detail": detail,
        }) + "\n")


def run_ruff(target: str) -> dict:
    if shutil.which("ruff") is None:
        return {"tool": "ruff", "status": "SKIPPED", "detail": "ruff not installed"}
    result = subprocess.run(["ruff", "check", target], capture_output=True, text=True, cwd=REPO_ROOT)
    return {
        "tool": "ruff",
        "status": "PASS" if result.returncode == 0 else "FAIL",
        "detail": result.stdout.strip() or result.stderr.strip(),
    }


def run_ast_grep(target: str) -> dict:
    if shutil.which("ast-grep") is None:
        return {"tool": "ast-grep", "status": "SKIPPED",
                 "detail": "ast-grep not installed — rule lives at .ast-grep/rules/no-hardcoded-sleep.yml"}
    result = subprocess.run(
        ["ast-grep", "scan", "--config", ".ast-grep/sgconfig.yml", target],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    return {
        "tool": "ast-grep",
        "status": "PASS" if result.returncode == 0 else "FAIL",
        "detail": result.stdout.strip() or result.stderr.strip(),
    }


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    file_path = payload.get("file_path") or payload.get("filePath") or ""

    if not file_path.startswith("src/tests/"):
        print(json.dumps({}))
        return

    checks = [run_ruff(file_path), run_ast_grep(file_path)]
    verdict = "FAIL" if any(c["status"] == "FAIL" for c in checks) else "PASS"
    requires_review = any(file_path.startswith(p) for p in PII_PREFIXES)

    log("gate_result", {
        "file": file_path,
        "checks": checks,
        "verdict": verdict,
        "requires_manual_review": requires_review,
    })

    parts = [f"Deterministic gate on {file_path}: {verdict}."]
    if requires_review:
        parts.append("PII/payroll-adjacent path — mandatory manual review regardless of gate result.")
    if verdict == "FAIL":
        parts.append("Fix lint/structure issues before this file goes to code-reviewer.")

    print(json.dumps({"agentMessage": " ".join(parts)}))


if __name__ == "__main__":
    main()
