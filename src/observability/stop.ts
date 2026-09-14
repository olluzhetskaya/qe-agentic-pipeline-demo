/**
 * Cursor hook: stop
 *
 * Re-runs the full pipeline gate set, then requires hash-fresh PASS
 * verdicts from the isolated judges. Writes out/draft_pr.md only when
 * both pass — a skipped or stale judge cannot ship.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getLangfuse, getTrace, score, flush, readStdin, formatNumberedList, REPO_ROOT } from './langfuse-client.js';
import { runPipelineGates } from '../validation/pipeline-gates.js';
import { runRequiredJudgeGates } from '../validation/verdict-gates.js';

const DRAFT_PR = path.join(REPO_ROOT, 'out', 'draft_pr.md');

const raw = await readStdin();
const convId = (JSON.parse(raw || '{}') as { conversation_id?: string }).conversation_id ?? 'unknown';

const pipeline = runPipelineGates();
const judges = runRequiredJudgeGates();
const findings = [...pipeline.findings, ...judges];
const pass = findings.length === 0;
const start = new Date();

const lf = getLangfuse();
const trace = getTrace(lf, convId);

try {
  trace?.generation({ name: 'pipeline-gate', model: process.env.CURSOR_MODEL ?? 'unknown', startTime: start }).end({
    output: { pass, findings },
    level: pass ? 'DEFAULT' : 'ERROR',
  });
  score(lf, convId, 'pipeline-gate', pass ? 1 : 0, findings[0]);
} catch { /* telemetry must not fail-close */ }
await flush(lf);

if (!pass) {
  process.stdout.write(JSON.stringify({
    agentMessage: [
      `Pipeline / judge gate FAIL (${findings.length} finding(s)):`,
      formatNumberedList(findings),
      'No draft PR written. Fix before spawning pr-drafter.',
    ].join('\n'),
  }));
  process.exit(1);
}

fs.mkdirSync(path.dirname(DRAFT_PR), { recursive: true });
fs.writeFileSync(DRAFT_PR,
  `# Draft PR — agent-generated test\n\n**Pipeline gate:** PASS\n**Judge verdicts:** PASS and hash-fresh\n\nA human must merge this manually.\n`,
);
process.stdout.write(JSON.stringify({
  agentMessage: 'Pipeline gate PASS. Hash-fresh judge verdicts present. Draft PR written to out/draft_pr.md.',
}));
