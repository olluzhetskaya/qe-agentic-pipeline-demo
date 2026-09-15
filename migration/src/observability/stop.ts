import fs from 'node:fs';
import path from 'node:path';
import {
  flush,
  formatNumberedList,
  getLangfuse,
  getTrace,
  readStdin,
  REPO_ROOT,
  score,
} from './langfuse-client.js';
import { runMigrationGateResult } from '../validation/migration-gates.js';
import { runRequiredJudgeGates } from '../validation/verdict-gates.js';

const raw = await readStdin();
const conversationId =
  (JSON.parse(raw || '{}') as { conversation_id?: string }).conversation_id ?? 'unknown';
const gate = runMigrationGateResult();
const findings = [...gate.findings, ...runRequiredJudgeGates()];
const pass = findings.length === 0;

const langfuse = getLangfuse(conversationId, 'migration');
try {
  getTrace(langfuse, conversationId)?.evaluator({
    name: 'migration-release-gate',
  }).end({
    input: { pipeline: 'cucumber-to-playwright' },
    output: { pass, findings },
  });
  score(langfuse, conversationId, 'migration-release-gate', pass ? 1 : 0, findings[0]);
} catch {
  // Observability must not change the gate result.
}
await flush(langfuse);

if (!pass) {
  process.stdout.write(JSON.stringify({
    agentMessage: [
      `Migration release gate FAIL (${findings.length} finding(s)).`,
      formatNumberedList(findings),
      'No draft PR was written.',
    ].join('\n'),
  }));
  process.exit(1);
}

const draft = path.join(REPO_ROOT, 'out/draft_migration_pr.md');
fs.mkdirSync(path.dirname(draft), { recursive: true });
fs.writeFileSync(
  draft,
  '# Draft PR — Cucumber-to-Playwright migration\n\n' +
    '**Migration gate:** PASS\n' +
    '**Judge verdicts:** PASS and hash-fresh\n\n' +
    'A human must merge this manually.\n',
);
process.stdout.write(JSON.stringify({
  agentMessage: 'Migration release gate PASS. Draft PR written to out/draft_migration_pr.md.',
}));
