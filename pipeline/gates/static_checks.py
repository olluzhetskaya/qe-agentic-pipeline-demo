"""
static_checks — Phase 3, the deterministic gate.

Runs real tools where they're installed (ruff for lint), and degrades
gracefully with a clear note where they're not (ast-grep, Sonar), so the
demo runs anywhere while showing the exact three checks ADR-014 specifies.
In CI, all three would be hard requirements with no fallback.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from ..hooks.trace_hook import log_event

REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_ruff(target: str) -> dict:
    if shutil.which("ruff") is None:
        return {"tool": "ruff", "status": "SKIPPED", "detail": "ruff not installed in this environment"}
    result = subprocess.run(
        ["ruff", "check", target], capture_output=True, text=True, cwd=REPO_ROOT
    )
    return {
        "tool": "ruff",
        "status": "PASS" if result.returncode == 0 else "FAIL",
        "detail": result.stdout.strip() or result.stderr.strip(),
    }


def _run_ast_grep(target: str) -> dict:
    if shutil.which("ast-grep") is None:
        return {
            "tool": "ast-grep",
            "status": "SKIPPED",
            "detail": "ast-grep not installed — rule lives at .ast-grep/rules/no-hardcoded-sleep.yml",
        }
    result = subprocess.run(
        ["ast-grep", "scan", "--config", ".ast-grep/sgconfig.yml", target],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    return {
        "tool": "ast-grep",
        "status": "PASS" if result.returncode == 0 else "FAIL",
        "detail": result.stdout.strip() or result.stderr.strip(),
    }


def _run_sonar_stub(target: str) -> dict:
    # Real setup: sonar-scanner CLI against sonar-project.properties in CI.
    # No Sonar server in this demo, so this is a heuristic stand-in only —
    # flags obviously long functions as a placeholder for real complexity analysis.
    code = (REPO_ROOT / target).read_text()
    longest_function_lines = max(
        (len(block.splitlines()) for block in code.split("\ndef ")), default=0
    )
    status = "PASS" if longest_function_lines < 40 else "FAIL"
    return {
        "tool": "sonar (heuristic stand-in)",
        "status": status,
        "detail": f"longest function ~{longest_function_lines} lines (see sonar-project.properties for real config)",
    }


def run(generated_file_path: str) -> dict:
    rel_path = str(Path(generated_file_path).relative_to(REPO_ROOT))
    log_event("static_checks", "pre_tool_call", {"target": rel_path})

    checks = [_run_ruff(rel_path), _run_ast_grep(rel_path), _run_sonar_stub(rel_path)]
    blocking_failures = [c for c in checks if c["status"] == "FAIL"]

    result = {
        "checks": checks,
        "verdict": "FAIL" if blocking_failures else "PASS",
    }
    log_event("static_checks", "gate_result", result)
    return result
