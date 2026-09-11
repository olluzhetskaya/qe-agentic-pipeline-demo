#!/usr/bin/env python3
"""
Cursor hook: beforeShellExecution
Fires before Cursor's agent (or any subagent with terminal access) runs a
shell command. This is the actual enforcement behind ADR-014's "no agent
merges, ever" rule — not a line in a subagent's prompt, a command-level
block that no subagent can reason or be prompted past.

Payload/response shape follows the documented pattern at
https://cursor.com/docs/agent/hooks — re-check field names there if
Cursor's schema has moved since this was written; hooks read a JSON object
from stdin and print a JSON object to stdout.
"""
import json
import re
import sys

BLOCKED_PATTERNS = [
    r"\bgit\s+merge\b",
    r"\bgit\s+push\b[^\n]*\b(main|master)\b",
    r"\bgh\s+pr\s+merge\b",
]


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    command = payload.get("command", "")

    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, command):
            print(json.dumps({
                "permission": "deny",
                "agentMessage": (
                    f"Blocked: '{command}' matches a merge/direct-push pattern. "
                    "Per ADR-014, no agent in this pipeline may merge or push "
                    "directly to main/master. Use pr-drafter to open a draft PR "
                    "and let a human merge it."
                ),
            }))
            return

    print(json.dumps({"permission": "allow"}))


if __name__ == "__main__":
    main()
