/**
 * Cursor hook: afterFileEdit
 *
 * Deterministic checks routed by file path:
 *
 * src/tests/*.spec.ts       → Stage 1 lint + ast-grep + pipeline (incl. quality)
 * data/*.json               → artifacts, run-state, checksum, optional xray-index
 * pages/data/fixtures/wiki  → source tools + repository relationship gates
 * validation/observability  → the code the hooks execute (self-gating)
 * agent definitions/hooks  → capability and hook-wiring gates
 *
 * Exits 1 on FAIL so failClosed hooks cannot look like a silent PASS.
 * Langfuse must not fail-close a green gate.
 *
 * Both emit a Langfuse span + score keyed on conversation_id. Artifact and
 * wiki/fixture writes also refresh the optional inspector snapshot when one
 * already exists, so a human never reads a projection older than the sources.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { getLangfuse, getTrace, score, flush, readStdin, formatNumberedList, REPO_ROOT } from './langfuse-client.js';
import { runPipelineGates } from '../validation/pipeline-gates.js';
import { loadWikiCatalog } from '../validation/wiki-rules.js';
import { reviewSnapshotExists, writeReviewSnapshot } from '../review/generate-review-data.js';

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' });
    return { ok: true, out: out.trim() };
  } catch (e: unknown) {
    const err = e as { code?: string; stdout?: string; message?: string };
    // Fail closed: a missing binary means the gate did not run, which is not a PASS.
    if (err.code === 'ENOENT')
      return { ok: false, out: `${cmd} not available — deterministic gate did not run` };
    return { ok: false, out: (err.stdout ?? err.message ?? '').toString().trim() };
  }
}

function failMessage(findings: string[]): string {
  const header = `[quality/design gate] data/: FAIL (${findings.length} issue(s)):`;
  return [header, formatNumberedList(findings), 'Fix before spawning the isolated judge.'].join('\n');
}

/**
 * Keeps the optional inspector's snapshot in step with the artifacts, but only
 * once a human has generated it — never creates it uninvited. The projection is
 * cosmetic, so a failure here is reported and never turns a PASS into a FAIL.
 */
async function refreshReviewSnapshot(): Promise<string> {
  if (!reviewSnapshotExists()) return '';
  try {
    return `Review snapshot refreshed: ${await writeReviewSnapshot()}`;
  } catch (reason) {
    return `Review snapshot not refreshed: ${(reason as Error).message}`;
  }
}

function emit(pass: boolean, agentMessage: string): never {
  process.stdout.write(JSON.stringify({ agentMessage }));
  process.exit(pass ? 0 : 1);
}

const raw     = await readStdin();
const payload = JSON.parse(raw || '{}') as { file_path?: string; filePath?: string; conversation_id?: string };
const rawFile = payload.file_path ?? payload.filePath ?? '';
const file    = (path.isAbsolute(rawFile) ? path.relative(REPO_ROOT, rawFile) : rawFile)
  .split(path.sep).join('/');
const convId  = payload.conversation_id ?? 'unknown';
const sensitiveDomains = loadWikiCatalog().sensitiveDomains;
const sensitiveHit = sensitiveDomains.find(domain =>
  file.toLowerCase().split(/[/\-_.]/).includes(domain));
const manualReviewNotice = sensitiveHit
  ? `MANUAL REVIEW REQUIRED: ${file} touches the "${sensitiveHit}" sensitive domain (wiki/sensitive_domains.md).`
  : '';

const lf    = getLangfuse();
const trace = getTrace(lf, convId);
const start = new Date();

function record(name: string, pass: boolean, output: unknown): void {
  try {
    trace?.span({ name, startTime: start }).end({
      input: { file },
      output,
      level: pass ? 'DEFAULT' : 'ERROR',
    });
    score(lf, convId, name, pass ? 1 : 0);
  } catch {
    /* telemetry must not fail-close */
  }
}

if (file.startsWith('src/tests/') && file.endsWith('.spec.ts')) {
  const lint = run('npx', ['--no-install', 'eslint', file]);
  const grep = run('npx', ['--no-install', 'ast-grep', 'scan', '--config', '.ast-grep/sgconfig.yml', file]);
  const architecture = runPipelineGates();
  const pass = lint.ok && grep.ok && architecture.pass;
  record('deterministic-gate-stage1', pass, {
    eslint: lint.out, astGrep: grep.out, architecture: architecture.findings,
  });
  await flush(lf);
  emit(pass, pass
    ? [`[Stage 1 gate] ${file}: PASS.`, manualReviewNotice].filter(Boolean).join('\n')
    : [
        `[Stage 1 gate] ${file}: FAIL. Fix lint, architecture, and quality issues before code-reviewer.`,
        lint.out,
        grep.out,
        formatNumberedList(architecture.findings),
        manualReviewNotice,
      ].filter(Boolean).join('\n'));

} else if (file.startsWith('data/') && file.endsWith('.json')) {
  const architecture = runPipelineGates();
  const findings = architecture.findings;
  const pass = architecture.pass;
  record('deterministic-gate-test-design', pass, { pass, findings });
  await flush(lf);
  const snapshot = await refreshReviewSnapshot();
  const msg = pass
    ? `[quality/design gate] ${file}: PASS.`
    : failMessage(findings);
  emit(pass, [msg, snapshot].filter(Boolean).join('\n'));

} else if (
  file.startsWith('src/data/') ||
  file.startsWith('src/pages/') ||
  file.startsWith('src/fixtures/') ||
  file.startsWith('src/validation/') ||
  file.startsWith('src/observability/') ||
  file.startsWith('wiki/') ||
  file.startsWith('.agents/agents/') ||
  file === '.cursor/hooks.json'
) {
  const architecture = runPipelineGates();
  const lint = file.startsWith('src/')
    ? run('npx', ['--no-install', 'eslint', file])
    : { ok: true, out: '' };
  const grep = file.startsWith('src/pages/')
    ? run('npx', ['--no-install', 'ast-grep', 'scan', '--config', '.ast-grep/sgconfig.yml', file])
    : { ok: true, out: '' };
  const pass = architecture.pass && lint.ok && grep.ok;
  const findings = architecture.findings;
  record('deterministic-gate-architecture', pass, {
    pass, findings, eslint: lint.out, astGrep: grep.out,
  });
  await flush(lf);
  const snapshot = await refreshReviewSnapshot();
  emit(pass, pass
    ? [`[architecture gate] ${file}: PASS.`, manualReviewNotice, snapshot]
      .filter(Boolean).join('\n')
    : [
        `[architecture gate] ${file}: FAIL. Fix deterministic issues:`,
        lint.out,
        grep.out,
        formatNumberedList(findings),
        manualReviewNotice,
        snapshot,
      ].filter(Boolean).join('\n'));
} else {
  process.stdout.write(JSON.stringify({}));
}
