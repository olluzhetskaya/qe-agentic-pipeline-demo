import { execFileSync } from 'node:child_process';
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

function run(command: string, args: string[]): { ok: boolean; output: string } {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }).trim(),
    };
  } catch (reason) {
    const error = reason as { stdout?: string; message?: string };
    return { ok: false, output: String(error.stdout ?? error.message ?? reason).trim() };
  }
}

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as {
  file_path?: string;
  filePath?: string;
  conversation_id?: string;
};
const rawFile = payload.file_path ?? payload.filePath ?? '';
const file = (path.isAbsolute(rawFile) ? path.relative(REPO_ROOT, rawFile) : rawFile)
  .split(path.sep)
  .join('/');
const isTypeScript = file.endsWith('.ts');
const watched = [
  'data/',
  'tests/',
  'pages/',
  'src/',
  '.agents/',
  '.cursor/',
  'kb/',
].some(prefix => file.startsWith(prefix));

if (!watched) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const lint = isTypeScript
  ? run('npx', ['--no-install', 'eslint', file, '--max-warnings', '0'])
  : { ok: true, output: '' };
const astGrep = isTypeScript
  ? run('npx', ['--no-install', 'ast-grep', 'scan', '--config', '.ast-grep/sgconfig.yml', file])
  : { ok: true, output: '' };
const gate = runMigrationGateResult();
const pass = lint.ok && astGrep.ok && gate.pass;
const findings = [lint.output, astGrep.output, ...gate.findings].filter(Boolean);

const conversationId = payload.conversation_id ?? 'unknown';
const langfuse = getLangfuse(conversationId, 'migration');
try {
  getTrace(langfuse, conversationId)?.evaluator({
    name: 'migration-after-file-edit',
  }).end({
    input: { file },
    output: { pass, findings },
  });
  score(langfuse, conversationId, 'migration-gate', pass ? 1 : 0, findings[0]);
} catch {
  // Observability must not change the gate result.
}
await flush(langfuse);

process.stdout.write(JSON.stringify({
  agentMessage: pass
    ? `[migration gate] ${file}: PASS.`
    : [
        `[migration gate] ${file}: FAIL.`,
        formatNumberedList(findings),
        'Fix the findings before an isolated review.',
      ].join('\n'),
}));
process.exit(pass ? 0 : 1);
