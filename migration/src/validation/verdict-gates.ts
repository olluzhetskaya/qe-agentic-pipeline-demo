/** Isolated-judge verdict artifacts. Prose is never a control input. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertConfidencePolicy } from './confidence-policy.js';
import { filesUnder, rel, ROOT } from './shared.js';

export const VERDICT_DIR = path.join(ROOT, 'data/verdicts');
const MIGRATION_MAPPING_TARGET = 'data/mapping.json';
const SPEC_DIR = path.join(ROOT, 'tests');

const AGENTS = new Set([
  'migration-design-reviewer',
  'migration-code-reviewer',
]);
const VERDICTS = new Set(['PASS', 'FAIL']);
const SEVERITIES = new Set(['WARN', 'FAIL']);
const KINDS = new Set(['semantic', 'static']);

export interface VerdictFinding {
  severity: string;
  confidence: number;
  kind: string;
  calibration: string | null;
  text: string;
}

export interface JudgeVerdict {
  agent: string;
  target: string;
  verdict: string;
  confidence: number;
  threshold: number;
  threshold_basis: string;
  rationale: string;
  findings: VerdictFinding[];
  escalate: string[] | null;
  target_sha256: string;
  reviewed_at: string;
}

export function contentHashOf(repoPath: string): string {
  const absolute = path.join(ROOT, repoPath);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  return `sha256:${hash}`;
}

function safeTarget(target: string): string | null {
  const absolute = path.resolve(ROOT, target);
  return absolute.startsWith(`${ROOT}${path.sep}`) ? absolute : null;
}

export function verdictFileName(agent: string, target: string): string {
  const encoded = target.replaceAll('/', '__').replaceAll('\\', '__');
  return `${agent}--${encoded}.json`;
}

function validateFinding(
  raw: unknown,
  label: string,
  index: number,
  findings: string[],
): VerdictFinding | null {
  const at = `${label}: finding ${index + 1}`;
  if (!raw || typeof raw !== 'object') {
    findings.push(`${at} must be an object`);
    return null;
  }
  const finding = raw as Record<string, unknown>;
  const severity = String(finding.severity ?? '');
  const kind = String(finding.kind ?? '');
  if (!SEVERITIES.has(severity)) findings.push(`${at}: severity must be WARN or FAIL`);
  if (!KINDS.has(kind)) findings.push(`${at}: kind must be semantic or static`);
  if (!Number.isInteger(finding.confidence) ||
      (finding.confidence as number) < 0 || (finding.confidence as number) > 100) {
    findings.push(`${at}: confidence must be an integer from 0 to 100`);
  }
  if (finding.calibration !== null &&
      (typeof finding.calibration !== 'string' || !finding.calibration.trim())) {
    findings.push(`${at}: calibration must be a non-empty string or null`);
  }
  if (typeof finding.text !== 'string' || !finding.text.trim()) {
    findings.push(`${at}: text is required`);
  }
  if (findings.some(findingText => findingText.startsWith(at))) return null;
  return {
    severity,
    confidence: finding.confidence as number,
    kind,
    calibration: finding.calibration as string | null,
    text: finding.text as string,
  };
}

export function parseVerdict(file: string, findings: string[]): JudgeVerdict | null {
  const label = rel(file);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    findings.push(`${label}: invalid JSON`);
    return null;
  }
  if (!raw || typeof raw !== 'object') {
    findings.push(`${label}: must be an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;
  const agent = String(record.agent ?? '');
  const target = String(record.target ?? '');
  const verdict = String(record.verdict ?? '');
  if (!AGENTS.has(agent)) {
    findings.push(
      `${label}: agent must be migration-design-reviewer or migration-code-reviewer`,
    );
  }
  if (typeof record.target !== 'string' || !record.target.trim()) {
    findings.push(`${label}: target is required`);
  }
  if (!VERDICTS.has(verdict)) findings.push(`${label}: verdict must be PASS or FAIL`);
  const threshold = assertConfidencePolicy(record, label, findings);
  if (!Number.isInteger(record.confidence) ||
      (record.confidence as number) < 0 || (record.confidence as number) > 100) {
    findings.push(`${label}: confidence must be an integer from 0 to 100`);
  } else if (verdict === 'PASS' && (record.confidence as number) < threshold) {
    findings.push(`${label}: confidence below ${threshold} cannot be PASS`);
  }
  if (typeof record.rationale !== 'string' || !record.rationale.trim()) {
    findings.push(`${label}: rationale is required`);
  }
  if (record.escalate !== null && !Array.isArray(record.escalate)) {
    findings.push(`${label}: escalate must be null or an array of strings`);
  }
  if (Array.isArray(record.escalate)) {
    if (record.escalate.length === 0) {
      findings.push(`${label}: escalate must be null when empty — do not store []`);
    }
    for (const [index, item] of record.escalate.entries()) {
      if (typeof item !== 'string' || !item.trim()) {
        findings.push(`${label}: escalate[${index}] must be a non-empty string`);
      }
    }
  }
  if (verdict === 'PASS' && record.escalate !== null) {
    findings.push(`${label}: PASS requires escalate null`);
  }
  if (!Array.isArray(record.findings)) {
    findings.push(`${label}: findings must be an array`);
  }
  const parsedFindings = Array.isArray(record.findings)
    ? record.findings.flatMap((finding, index) => {
        const parsed = validateFinding(finding, label, index, findings);
        return parsed ? [parsed] : [];
      })
    : [];
  if (verdict === 'PASS' && parsedFindings.some(finding => finding.severity === 'FAIL')) {
    findings.push(`${label}: PASS is incompatible with a FAIL finding`);
  }
  if (verdict === 'FAIL' && !parsedFindings.some(finding => finding.severity === 'FAIL')) {
    findings.push(`${label}: FAIL requires at least one FAIL finding`);
  }
  if (typeof record.target_sha256 !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(record.target_sha256)) {
    findings.push(`${label}: target_sha256 must be sha256:<64 lowercase hex characters>`);
  }
  if (typeof record.reviewed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.reviewed_at)) {
    findings.push(`${label}: reviewed_at must be an ISO-8601 timestamp`);
  }
  const absolute = safeTarget(target);
  if (target && (!absolute || !fs.existsSync(absolute))) {
    findings.push(`${label}: target "${target}" does not exist`);
  } else if (target && record.target_sha256 !== contentHashOf(target)) {
    findings.push(
      `${label}: target_sha256 is stale — ${target} changed after this verdict; re-run ${agent}`,
    );
  }
  if (agent === 'migration-design-reviewer' && target !== MIGRATION_MAPPING_TARGET) {
    findings.push(
      `${label}: migration-design-reviewer target must be ${MIGRATION_MAPPING_TARGET}`,
    );
  }
  if (agent === 'migration-code-reviewer' &&
      (!target.startsWith('tests/') || !target.endsWith('.spec.ts'))) {
    findings.push(
      `${label}: migration-code-reviewer target must be under tests/ and end in .spec.ts`,
    );
  }
  if (agent && target && path.basename(file) !== verdictFileName(agent, target)) {
    findings.push(`${label}: filename must be ${verdictFileName(agent, target)}`);
  }
  if (findings.some(finding => finding.startsWith(label))) return null;
  return {
    agent,
    target,
    verdict,
    confidence: record.confidence as number,
    threshold,
    threshold_basis: String(record.threshold_basis),
    rationale: record.rationale as string,
    findings: parsedFindings,
    escalate: Array.isArray(record.escalate) ? record.escalate.map(String) : null,
    target_sha256: record.target_sha256 as string,
    reviewed_at: record.reviewed_at as string,
  };
}

export function loadVerdicts(findings: string[] = []): JudgeVerdict[] {
  return filesUnder(VERDICT_DIR, '.json').flatMap(file => {
    const parsed = parseVerdict(file, findings);
    return parsed ? [parsed] : [];
  });
}

export function runVerdictGates(): string[] {
  const findings: string[] = [];
  const verdicts = loadVerdicts(findings);
  const keys = new Set<string>();
  for (const verdict of verdicts) {
    const key = `${verdict.agent}\0${verdict.target}`;
    if (keys.has(key)) {
      findings.push(`data/verdicts/: duplicate verdict for ${verdict.agent} on ${verdict.target}`);
    }
    keys.add(key);
  }
  return findings;
}

function requirePass(agent: string, target: string, verdicts: JudgeVerdict[], findings: string[]): void {
  const match = verdicts.find(entry => entry.agent === agent && entry.target === target);
  if (!match) {
    findings.push(`data/verdicts/: missing ${agent} PASS verdict for ${target}`);
    return;
  }
  if (match.verdict !== 'PASS') {
    findings.push(`data/verdicts/: ${agent} on ${target} is ${match.verdict} — cannot draft a PR`);
  }
}

/** One control decision. Coordinators call this instead of reading judge prose. */
export function runVerdictDecisionGate(agent: string, target: string): string[] {
  const findings: string[] = [];
  const verdicts = loadVerdicts(findings);
  requirePass(agent, target, verdicts, findings);
  return findings;
}

/** Presence + PASS. Hash freshness is `runVerdictGates`. Used by `stop` only. */
export function runRequiredJudgeGates(): string[] {
  const findings: string[] = [];
  const verdicts = loadVerdicts(findings);
  requirePass('migration-design-reviewer', MIGRATION_MAPPING_TARGET, verdicts, findings);
  for (const file of filesUnder(SPEC_DIR, '.spec.ts')) {
    requirePass(
      'migration-code-reviewer',
      rel(file).split(path.sep).join('/'),
      verdicts,
      findings,
    );
  }
  return findings;
}
