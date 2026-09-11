"""
enforcement — the unconditional gates from ADR-014's "human intervention
points" section, expressed as code instead of policy text.

This is the distinction the L4 course draws between an *advisory instruction*
(something in a prompt telling the agent "please don't merge directly") and
an *enforcement gate* (something the agent has no code path around, because
the capability simply doesn't exist). Everything in this file is the second
kind — notice there is no `merge()` function anywhere in pr_agent.py at all,
and the two guards below are called from the orchestrator regardless of what
any agent "decides."
"""
from __future__ import annotations

from .trace_hook import log_event

PII_ADJACENT_PATH_PREFIXES = (
    "src/pages/payroll",
    "src/tests/payroll",
    "src/tests/pii",
)


class EnforcementBlocked(Exception):
    """Raised when a pipeline step tries to cross a hard boundary."""


def enforce_draft_pr_only(pr_payload: dict) -> None:
    """
    Called unconditionally after pr_agent builds its output. There is no
    merge credential anywhere in this codebase for the pipeline to use, so
    this function is a belt-and-suspenders check, not the only line of
    defense — but it's here so the boundary is visible and testable, not
    just true by omission.
    """
    if pr_payload.get("status") == "merged":
        log_event("enforcement", "blocked", {"reason": "attempted direct merge"})
        raise EnforcementBlocked(
            "Pipeline attempted to set PR status to 'merged'. "
            "No agent in this pipeline is permitted to merge. Blocked."
        )


def enforce_pii_path_review(generated_file_path: str) -> bool:
    """
    Returns True if the file requires mandatory human review regardless of
    gate results (payroll / PII-adjacent test data), per ADR-014.
    """
    requires_review = any(
        generated_file_path.startswith(prefix) for prefix in PII_ADJACENT_PATH_PREFIXES
    )
    if requires_review:
        log_event(
            "enforcement",
            "blocked",
            {
                "reason": "PII-adjacent path — mandatory manual review",
                "path": generated_file_path,
            },
        )
    return requires_review
