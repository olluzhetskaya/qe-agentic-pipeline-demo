/**
 * Cursor hook: beforeShellExecution
 * Blocks merge/direct-push commands. Emits a blocked-command event to Langfuse.
 */
import { getLangfuse, getTrace, flush, readStdin } from './langfuse-client.js';

const BLOCKED = [
  /\bgit\s+merge\b/,
  /\bgit\s+rebase\b/,
  /\bgit\s+push\b[^\n]*\b(--force|--force-with-lease|-f)\b/,
  /\bgit\s+push\b[^\n]*\b(main|master|release)\b/,
  /\bgh\s+pr\s+merge\b/,
  /\bgh\s+api\b[^\n]*\b\/merges?\b/,
];

const raw     = await readStdin();
const payload = JSON.parse(raw || '{}') as { command?: string; conversation_id?: string };
const command = payload.command ?? '';
const convId  = payload.conversation_id ?? 'unknown';
const match   = BLOCKED.find(p => p.test(command));

if (match) {
  const lf    = getLangfuse();
  const trace = getTrace(lf, convId);
  trace?.event({ name: 'blocked-command', input: { command }, level: 'WARNING' });
  await flush(lf);

  process.stdout.write(JSON.stringify({
    permission: 'deny',
    agentMessage: `Blocked: '${command}' matches a merge/direct-push pattern. Per ADR-014, no agent may merge or force-push; this regex list is defense-in-depth behind pr-drafter's missing terminal, not a complete sandbox. Use pr-drafter and let a human merge.`,
  }));
} else {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}
