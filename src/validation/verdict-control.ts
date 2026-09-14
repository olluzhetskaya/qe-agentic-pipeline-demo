/**
 * Deterministic context and decision commands for isolated judges.
 *
 * `context` runs before the judge. The coordinator passes its JSON output to
 * the judge unchanged. `check` runs after the judge writes the verdict file.
 * The coordinator never parses prose.
 */
import path from 'node:path';
import {
  contentHashOf,
  runVerdictDecisionGate,
  verdictFileName,
  VERDICT_DIR,
} from './verdict-gates.js';
import { formatNumberedList } from '../observability/langfuse-client.js';
import { rel, ROOT } from './shared.js';

const [command, agent = '', target = ''] = process.argv.slice(2);
const allowedAgent = agent === 'code-reviewer' || agent === 'test-design-reviewer';
const normalizedTarget = path.relative(ROOT, path.resolve(ROOT, target)).split(path.sep).join('/');
const targetAllowed = normalizedTarget &&
  !normalizedTarget.startsWith('../') &&
  (agent === 'test-design-reviewer'
    ? normalizedTarget === 'data/test-design.json'
    : normalizedTarget.startsWith('src/tests/') && normalizedTarget.endsWith('.spec.ts'));

if (!allowedAgent || !targetAllowed) {
  process.stderr.write(
    'usage: verdict-control <context|check> <test-design-reviewer|code-reviewer> <allowed target>\n',
  );
  process.exit(2);
}

if (command === 'context') {
  process.stdout.write(`${JSON.stringify({
    agent,
    target: normalizedTarget,
    target_sha256: contentHashOf(normalizedTarget),
    output: rel(path.join(VERDICT_DIR, verdictFileName(agent, normalizedTarget)))
      .split(path.sep).join('/'),
  }, null, 2)}\n`);
} else if (command === 'check') {
  const findings = runVerdictDecisionGate(agent, normalizedTarget);
  if (findings.length) {
    process.stderr.write([
      `verdict decision: FAIL (${findings.length})`,
      formatNumberedList(findings),
      '',
    ].join('\n'));
    process.exit(1);
  }
  process.stdout.write(`verdict decision: PASS — ${agent} on ${normalizedTarget}\n`);
} else {
  process.stderr.write('first argument must be context or check\n');
  process.exit(2);
}
