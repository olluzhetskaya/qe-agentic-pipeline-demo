"""
spec_checker — Phase 1.

Real version: calls an LLM with the ticket + retrieved wiki chunks, applying
the spec_writer skill, and returns structured Given/When/Then blocks.

Demo version: the "retrieval" and "generation" are replaced with direct file
reads and a light transform, so the pipeline is runnable with no API key and
no network access — but the phase boundary, the skill it applies, and the
trace events are the real thing this stands in for.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..hooks.trace_hook import log_event

REPO_ROOT = Path(__file__).resolve().parents[2]


def run(ticket_path: str = "data/ticket.json") -> dict:
    log_event("spec_checker", "pre_tool_call", {"tool": "read_ticket", "path": ticket_path})
    ticket = json.loads((REPO_ROOT / ticket_path).read_text())

    log_event("spec_checker", "pre_tool_call", {"tool": "retrieve_wiki",
                                                 "refs": ticket["wiki_refs"]})
    wiki_text = (REPO_ROOT / "wiki" / "business_domain.md").read_text()
    grounded = {
        ref: (ref in wiki_text) for ref in ticket["wiki_refs"]
    }

    spec = {
        "ticket_id": ticket["id"],
        "criteria": ticket["acceptance_criteria"],
        "wiki_grounding": grounded,  # confirms each cited rule actually exists in the wiki
    }

    log_event("spec_checker", "post_tool_call", {
        "criteria_count": len(spec["criteria"]),
        "deterministic": sum(1 for c in spec["criteria"] if c["type"] == "deterministic"),
        "judge": sum(1 for c in spec["criteria"] if c["type"] == "judge"),
    })
    return spec
