#!/usr/bin/env node
/**
 * Cursor hook: beforeShellExecution
 * Fires before Cursor's agent (or any subagent with terminal access) runs a
 * shell command. This is the actual enforcement behind ADR-014's "no agent
 * merges, ever" rule — not a line in an agent's prompt, a command-level
 * block that no agent can reason or be prompted past.
 *
 * Payload/response shape follows the documented pattern at
 * https://cursor.com/docs/agent/hooks — re-check field names there if
 * Cursor's schema has moved since this was written; hooks read a JSON
 * object from stdin and print a JSON object to stdout.
 */
const BLOCKED_PATTERNS = [
  /\bgit\s+merge\b/,
  /\bgit\s+push\b[^\n]*\b(main|master)\b/,
  /\bgh\s+pr\s+merge\b/,
];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    payload = {};
  }

  const command = payload.command || '';

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      process.stdout.write(
        JSON.stringify({
          permission: 'deny',
          agentMessage:
            `Blocked: '${command}' matches a merge/direct-push pattern. ` +
            'Per ADR-014, no agent in this pipeline may merge or push ' +
            'directly to main/master. Use pr-drafter to open a draft PR ' +
            'and let a human merge it.',
        }),
      );
      return;
    }
  }

  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

main();
