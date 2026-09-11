#!/usr/bin/env node
/**
 * Cursor hook: afterFileEdit
 * Fires after the agent edits/writes a file. This is ADR-014's Phase 3 (the
 * deterministic gate) running automatically the moment test-generator writes
 * a file, instead of waiting for a human — or an agent — to remember to run
 * lint separately.
 *
 * Only acts on files under src/tests/; everything else is a silent
 * pass-through.
 *
 * Payload/response shape follows the documented pattern at
 * https://cursor.com/docs/agent/hooks — re-check field names there (this
 * demo reads either `file_path` or `filePath`) if Cursor's schema has moved on.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRACE_FILE = path.join(REPO_ROOT, 'traces', 'trace.jsonl');
const PII_PREFIXES = ['src/pages/payroll', 'src/tests/payroll', 'src/tests/pii'];

function log(eventType, detail) {
  fs.mkdirSync(path.dirname(TRACE_FILE), { recursive: true });
  const record = {
    ts: new Date().toISOString(),
    hook: 'afterFileEdit',
    event_type: eventType,
    detail,
  };
  fs.appendFileSync(TRACE_FILE, JSON.stringify(record) + '\n');
}

function runBin(bin, args) {
  try {
    const out = execFileSync(bin, args, { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: 'PASS', detail: out.trim() };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { status: 'SKIPPED', detail: `${bin} not installed` };
    }
    return { status: 'FAIL', detail: (err.stdout || err.message || '').toString().trim() };
  }
}

function runEslint(target) {
  // Bundles eslint-plugin-playwright AND eslint-plugin-sonarjs — Sonar's
  // own JS/TS rule set, exposed as a real, locally-runnable ESLint plugin.
  // This one ESLint invocation is the actual local Sonar coverage this demo
  // exercises; sonar-project.properties is separate, for a live SonarQube/
  // SonarCloud server in CI on top of this.
  const result = runBin('npx', ['--no-install', 'eslint', target]);
  return { tool: 'eslint (playwright + sonarjs plugins)', ...result };
}

function runAstGrep(target) {
  const result = runBin('npx', ['--no-install', 'ast-grep', 'scan', '--config', '.ast-grep/sgconfig.yml', target]);
  if (result.status === 'SKIPPED') {
    result.detail = 'ast-grep not installed — rule lives at .ast-grep/rules/no-hardcoded-wait.yml';
  }
  return { tool: 'ast-grep', ...result };
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
  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    payload = {};
  }

  const filePath = payload.file_path || payload.filePath || '';

  if (!filePath.startsWith('src/tests/') || !filePath.endsWith('.spec.ts')) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const checks = [runEslint(filePath), runAstGrep(filePath)];
  const verdict = checks.some((c) => c.status === 'FAIL') ? 'FAIL' : 'PASS';
  const requiresReview = PII_PREFIXES.some((p) => filePath.startsWith(p));

  log('gate_result', { file: filePath, checks, verdict, requires_manual_review: requiresReview });

  const parts = [`Deterministic gate on ${filePath}: ${verdict}.`];
  if (requiresReview) {
    parts.push('PII/payroll-adjacent path — mandatory manual review regardless of gate result.');
  }
  if (verdict === 'FAIL') {
    parts.push('Fix lint/structure issues before this file goes to code-reviewer.');
  }

  process.stdout.write(JSON.stringify({ agentMessage: parts.join(' ') }));
}

main();
