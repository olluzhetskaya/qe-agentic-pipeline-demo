"""
pr_agent — Phase 5.

Notice what's absent: there is no `merge()` method anywhere in this file.
That's deliberate, not an oversight — it's the enforcement mechanism ADR-014
describes. An agent can't be prompted around a capability that was never
built. pipeline/hooks/enforcement.py adds a second, explicit check on top of
this, but the real boundary is that this class only knows how to draft.
"""
from __future__ import annotations

from pathlib import Path

from ..hooks.enforcement import enforce_draft_pr_only, enforce_pii_path_review
from ..hooks.trace_hook import log_event

REPO_ROOT = Path(__file__).resolve().parents[2]
DRAFT_PR_PATH = REPO_ROOT / "docs" / "draft_pr.md"


def run(generated_file_path: str, review_result: dict, spec: dict) -> dict:
    rel_path = str(Path(generated_file_path).relative_to(REPO_ROOT))
    requires_manual_review = enforce_pii_path_review(rel_path)

    pr_payload = {
        "status": "draft",  # the only status this agent is capable of setting
        "title": f"[agent-generated] tests for {spec['ticket_id']}",
        "file": rel_path,
        "gate_verdict": review_result["verdict"],
        "requires_manual_review": requires_manual_review,
    }

    enforce_draft_pr_only(pr_payload)  # no-op today; proves the guard is live

    body = f"""# Draft PR — {pr_payload['title']}

**Status:** {pr_payload['status'].upper()} (this pipeline cannot set any other status)
**File:** `{pr_payload['file']}`
**Semantic gate verdict:** {pr_payload['gate_verdict']}
**Findings:** {review_result['findings'] or 'none'}
**Reviewer note:** {review_result['reviewer_note']}
**Mandatory manual review (PII/payroll path):** {pr_payload['requires_manual_review']}

---
A human must open this PR and merge it manually. No credential in this
pipeline is capable of merging on its own.
"""
    DRAFT_PR_PATH.write_text(body)

    log_event("pr_agent", "pr_created", pr_payload)
    return pr_payload
