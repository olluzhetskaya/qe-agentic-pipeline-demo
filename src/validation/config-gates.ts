/** Deterministic capability, hook-wiring, and artifact-hygiene checks. */
import fs from 'node:fs';
import path from 'node:path';
import { runHarnessChecksumGate } from './harness-checksum.js';
import { runRunStateGates } from './run-state.js';
import { filesUnder, rel, ROOT } from './shared.js';
import { runXrayIndexGates } from './xray-index.js';

const AGENT_DIR = path.join(ROOT, '.agents/agents');
const HOOKS_PATH = path.join(ROOT, '.cursor/hooks.json');
const DATA_DIR = path.join(ROOT, 'data');

/** Committed artifacts. `data/xray-index.json` is generated client data — optional. */
const REQUIRED_DATA_ARTIFACTS = [
  'requirement.json',
  'test-design.json',
  'run-state.json',
  'harness-checksum.json',
] as const;

interface HooksFile {
  version?: unknown;
  hooks?: Record<string, Array<{ command?: unknown; failClosed?: unknown }>>;
}

interface AgentPolicy {
  readonly?: string;
  tools?: string;
  disallowedTools?: string;
}

const REQUIRED_HOOKS: Record<string, string> = {
  sessionStart: 'src/observability/session-start.ts',
  beforeShellExecution: 'src/observability/before-shell-execution.ts',
  beforeMCPExecution: 'src/observability/before-mcp-execution.ts',
  afterFileEdit: 'src/observability/after-file-edit.ts',
  stop: 'src/observability/stop.ts',
  afterAgentResponse: 'src/observability/after-agent-response.ts',
};

const AGENT_POLICIES: Record<string, AgentPolicy> = {
  'code-reviewer.md': { tools: 'read, grep, edit' },
  'test-design-reviewer.md': { tools: 'read, grep, edit' },
  'pr-drafter.md': { disallowedTools: 'terminal' },
  'xray-publisher.md': { tools: 'read, edit, mcp' },
};

function frontmatter(file: string): Map<string, string> {
  const source = fs.readFileSync(file, 'utf8');
  const block = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return new Map(block.split('\n').flatMap(line => {
    const separator = line.indexOf(':');
    return separator < 0
      ? []
      : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  }));
}

function validateAgentCapabilities(findings: string[]): void {
  const actualNames = new Set(filesUnder(AGENT_DIR, '.md').map(file => path.basename(file)));
  for (const name of Object.keys(AGENT_POLICIES)) {
    if (!actualNames.has(name)) findings.push(`.agents/agents/: missing isolated agent "${name}"`);
  }

  for (const file of filesUnder(AGENT_DIR, '.md')) {
    const policy = AGENT_POLICIES[path.basename(file)];
    if (!policy) {
      findings.push(`${rel(file)}: unregistered isolated agent; define its capability policy`);
      continue;
    }
    const metadata = frontmatter(file);
    if ((path.basename(file) === 'code-reviewer.md' ||
         path.basename(file) === 'test-design-reviewer.md') &&
        metadata.has('readonly')) {
      findings.push(
        `${rel(file)}: readonly must be absent so the judge can write its verdict artifact`,
      );
    }
    for (const [key, expected] of Object.entries(policy)) {
      if (metadata.get(key) !== expected) {
        findings.push(`${rel(file)}: frontmatter ${key} must be "${expected}"`);
      }
    }
  }
}

function validateHookWiring(findings: string[]): void {
  let config: HooksFile;
  try {
    config = JSON.parse(fs.readFileSync(HOOKS_PATH, 'utf8')) as HooksFile;
  } catch {
    findings.push('.cursor/hooks.json: invalid or missing JSON');
    return;
  }
  if (config.version !== 1) findings.push('.cursor/hooks.json: version must be 1');

  for (const [event, script] of Object.entries(REQUIRED_HOOKS)) {
    const definitions = config.hooks?.[event] ?? [];
    if (!definitions.some(definition =>
      typeof definition.command === 'string' && definition.command.includes(script))) {
      findings.push(`.cursor/hooks.json: ${event} must run ${script}`);
    }
    if ((event === 'beforeShellExecution' || event === 'beforeMCPExecution' ||
         event === 'afterFileEdit' || event === 'stop') &&
        !definitions.some(definition => definition.failClosed === true)) {
      findings.push(`.cursor/hooks.json: ${event} must fail closed`);
    }
    if (!fs.existsSync(path.join(ROOT, script))) {
      findings.push(`.cursor/hooks.json: configured script does not exist: ${script}`);
    }
  }
}

/**
 * Keeps the JSON artifacts machine-readable and diff-stable for reviewers and
 * the optional inspector. It constrains whitespace, not line layout — compact
 * step objects stay compact.
 */
function validateArtifactFormatting(file: string, findings: string[]): void {
  const label = rel(file);
  const source = fs.readFileSync(file, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (reason) {
    findings.push(`${label}: invalid JSON (${(reason as Error).message})`);
    return;
  }
  validateNoSentinels(parsed, label, findings);
  if (source.includes('\r')) findings.push(`${label}: must use LF line endings`);
  if (!source.endsWith('\n')) findings.push(`${label}: must end with a newline`);
  if (source.endsWith('\n\n')) findings.push(`${label}: must end with exactly one newline`);

  for (const [index, line] of source.split('\n').entries()) {
    const at = `${label}:${index + 1}`;
    if (/\s$/.test(line)) findings.push(`${at}: trailing whitespace`);
    const indent = line.match(/^[ \t]*/)?.[0] ?? '';
    if (indent.includes('\t')) findings.push(`${at}: indent with spaces, not tabs`);
    else if (line.trim() && indent.length % 2 !== 0) {
      findings.push(`${at}: indent must be a multiple of 2 spaces`);
    }
  }
}

function validateNoSentinels(value: unknown, at: string, findings: string[]): void {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'n/a' || normalized === 'tbd' ||
        normalized === 'unknown') {
      findings.push(`${at}: use JSON null instead of ${JSON.stringify(value)}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoSentinels(entry, `${at}[${index}]`, findings));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      validateNoSentinels(entry, `${at}.${key}`, findings);
    }
  }
}

export function runConfigGates(): string[] {
  const findings: string[] = [];
  validateAgentCapabilities(findings);
  validateHookWiring(findings);
  findings.push(...runHarnessChecksumGate());
  findings.push(...runRunStateGates());
  for (const name of REQUIRED_DATA_ARTIFACTS) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) findings.push(`data/${name}: required artifact is missing`);
  }
  for (const file of filesUnder(DATA_DIR, '.json')) {
    validateArtifactFormatting(file, findings);
  }
  findings.push(...runXrayIndexGates());
  return findings;
}
