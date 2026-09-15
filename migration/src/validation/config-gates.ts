import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { filesUnder, parseSource, rel, ROOT } from './shared.js';

const REQUIRED_AGENTS: Record<string, { key: string; value: string }> = {
  'migration-design-reviewer.md': { key: 'tools', value: 'read, grep, edit' },
  'migration-code-reviewer.md': { key: 'tools', value: 'read, grep, edit' },
  'migration-pr-drafter.md': { key: 'disallowedTools', value: 'terminal' },
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

function validateAgents(findings: string[]): void {
  const directory = path.join(ROOT, '.agents/agents');
  for (const [name, policy] of Object.entries(REQUIRED_AGENTS)) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) {
      findings.push(`.agents/agents/: missing ${name}`);
      continue;
    }
    const metadata = frontmatter(file);
    if (metadata.get(policy.key) !== policy.value) {
      findings.push(`${rel(file)}: ${policy.key} must be "${policy.value}"`);
    }
  }
}

function validateHooks(findings: string[]): void {
  const file = path.join(ROOT, '.cursor/hooks.json');
  let record: { hooks?: Record<string, Array<{ command?: string; failClosed?: boolean }>> };
  try {
    record = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof record;
  } catch {
    findings.push('.cursor/hooks.json: missing or invalid JSON');
    return;
  }
  for (const event of ['beforeShellExecution', 'afterFileEdit', 'stop']) {
    const hook = record.hooks?.[event]?.[0];
    if (!hook) {
      findings.push(`.cursor/hooks.json: missing ${event}`);
    } else if (hook.failClosed !== true) {
      findings.push(`.cursor/hooks.json: ${event} must be failClosed`);
    }
  }
}

function validateBoundary(findings: string[]): void {
  for (const file of filesUnder(path.join(ROOT, 'src'), '.ts')) {
    const source = parseSource(file);
    const specifiers: string[] = [];
    source.forEachChild(node => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      }
    });
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
        findings.push(`${rel(file)}: import "${specifier}" crosses the project boundary`);
      }
    }
  }
}

export function runConfigGates(): string[] {
  const findings: string[] = [];
  validateAgents(findings);
  validateHooks(findings);
  validateBoundary(findings);
  if (!fs.existsSync(path.join(ROOT, '.cursor/commands/migrate-pipeline.md'))) {
    findings.push('.cursor/commands/migrate-pipeline.md: missing');
  }
  return findings;
}
