#!/usr/bin/env node
/**
 * Cursor hook: stop
 * Fires when the agent session ends. Runs a lightweight, independent version
 * of the semantic/judge gate against the last generated test file, then
 * writes — or refuses to write — the draft PR, and appends a session
 * summary to the trace log either way.
 *
 * This is where the L3 course's "grade asynchronously from the artifact
 * alone" habit becomes literal: whoever reads traces/trace.jsonl afterward
 * doesn't need to have watched the session happen.
 *
 * Payload/response shape follows the documented pattern at
 * https://cursor.com/docs/agent/hooks — re-check field names there if
 * Cursor's schema has moved since this was written.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRACE_FILE = path.join(REPO_ROOT, 'traces', 'trace.jsonl');
const GENERATED_TEST = path.join(REPO_ROOT, 'src', 'tests', 'tenant-onboarding-generated.spec.ts');
const DRAFT_PR = path.join(REPO_ROOT, 'docs', 'draft_pr.md');

// Same seeded patterns as golden_dataset/dirty/*.spec.ts — kept in sync so
// this independent check and code-reviewer's judgment are calibrated the
// same way.
const VIOLATION_PATTERNS = {
  'page.waitForTimeout(': 'Hardcoded wait instead of an explicit Playwright wait.',
  'expect(page.url()).toBeTruthy()': 'Not a real assertion tied to an acceptance criterion.',
  'isFinishEnabled()).toBe(true)': 'Possible inversion of business rule 1 (submission gating) — cross-check wiki.',
};

function log(eventType, detail) {
  fs.mkdirSync(path.dirname(TRACE_FILE), { recursive: true });
  const record = {
    ts: new Date().toISOString(),
    hook: 'stop',
    event_type: eventType,
    detail,
  };
  fs.appendFileSync(TRACE_FILE, JSON.stringify(record) + '\n');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();
  try {
    JSON.parse(raw || '{}'); // conversation_id, loop_count, etc. — unused in this demo
  } catch {
    // ignore malformed payload, still safe to proceed
  }

  if (!fs.existsSync(GENERATED_TEST)) {
    log('no_op', { reason: 'no generated test file found this session' });
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const code = fs.readFileSync(GENERATED_TEST, 'utf8');
  const findings = Object.entries(VIOLATION_PATTERNS)
    .filter(([pattern]) => code.includes(pattern))
    .map(([, message]) => message);
  const verdict = findings.length > 0 ? 'FAIL' : 'PASS';

  log('gate_result', { phase: 'semantic_review', verdict, findings });

  if (verdict === 'FAIL') {
    log('blocked', { reason: 'semantic gate failed at session end, no PR drafted' });
    process.stdout.write(
      JSON.stringify({
        agentMessage:
          `Session ended with a FAILING semantic gate (${findings.length} finding(s)). ` +
          'No draft PR was written. See traces/trace.jsonl for detail.',
      }),
    );
    return;
  }

  fs.mkdirSync(path.dirname(DRAFT_PR), { recursive: true });
  fs.writeFileSync(
    DRAFT_PR,
    '# Draft PR — agent-generated test\n\n' +
      '**Status:** DRAFT (no agent in this pipeline can set any other status)\n' +
      `**File:** \`${path.relative(REPO_ROOT, GENERATED_TEST)}\`\n` +
      '**Semantic gate:** PASS\n\n' +
      'A human must open and merge this manually.\n',
  );
  log('pr_created', { file: path.relative(REPO_ROOT, GENERATED_TEST), status: 'draft' });
  process.stdout.write(
    JSON.stringify({
      agentMessage: 'Semantic gate PASS. Draft PR written to docs/draft_pr.md — a human merges it.',
    }),
  );
}

main();
