/**
 * Suite intelligence scan. Writes data/analysis.json.
 * Facts only: anti-patterns, duplicates, coupling, proposed batches.
 * Read-only on the SUT. Does not write run-state.batch.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_PATH = path.join(ROOT, 'data/inventory.json');
const ANALYSIS_PATH = path.join(ROOT, 'data/analysis.json');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);
const SKIP_TAGS = new Set(['@skip', '@ignore', '@wip', '@pending']);
const INFRA_GLUE = /\/(Login|Navigation)\.steps\.ts$/;

const PATTERNS: Array<{ kind: string; action: 'do_not_copy' | 'rewrite'; re: RegExp }> = [
  { kind: 'wait_for_timeout', action: 'do_not_copy', re: /waitForTimeout\s*\(/ },
  { kind: 'xpath_locator', action: 'do_not_copy', re: /xpath\s*=/i },
  { kind: 'hashed_css', action: 'do_not_copy', re: /locator\(\s*['"][^'"]*css-[a-z0-9]+/i },
  { kind: 'boolean_literal_assertion', action: 'rewrite', re: /\.toBe\(\s*(true|false)\s*\)/ },
  { kind: 'boolean_pom_method', action: 'rewrite', re: /:\s*Promise<\s*boolean\s*>/ },
  { kind: 'visibility_probe_as_wait', action: 'rewrite', re: /await\s+\w[\w.]*\.is(?:Visible|Enabled|Disabled|Hidden)\(\s*\)/ },
];

interface InventoryStep {
  keyword?: unknown;
  text?: unknown;
  glue?: unknown;
}

interface InventoryScenario {
  name?: unknown;
  tags?: unknown;
  steps?: InventoryStep[];
}

interface InventoryFeature {
  path?: unknown;
  name?: unknown;
  tags?: unknown;
  scenarios?: InventoryScenario[];
}

interface StepPattern {
  pattern?: unknown;
  line?: unknown;
}

interface StepDefinition {
  path?: unknown;
  patterns?: StepPattern[];
}

interface InventoryFile {
  sut_root?: unknown;
  features?: InventoryFeature[];
  step_definitions?: StepDefinition[];
  hooks?: unknown;
}

interface ScenarioRef {
  feature_path: string;
  scenario: string;
}

interface AntiPattern {
  kind: string;
  path: string;
  line: number;
  excerpt: string;
  action: 'do_not_copy' | 'rewrite';
}

interface CouplingRow extends ScenarioRef {
  glue_modules: string[];
  hook_files: string[];
  data_imports: string[];
  unbound_step_count: number;
  coupling_depth: number;
  tags: string[];
}

function sha256File(file: string): string {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return `sha256:${hash}`;
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
}

function glueModule(glue: unknown): string | null {
  if (typeof glue !== 'string' || !glue.trim()) return null;
  const split = glue.lastIndexOf(':');
  return split === -1 ? glue : glue.slice(0, split);
}

function walk(dir: string, suffix: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, suffix, acc);
    else if (entry.name.endsWith(suffix)) acc.push(full);
  }
  return acc;
}

function scanFile(abs: string, sutRoot: string, findings: AntiPattern[]): void {
  const rel = path.relative(sutRoot, abs).split(path.sep).join('/');
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  for (const [index, line] of lines.entries()) {
    for (const pattern of PATTERNS) {
      if (!pattern.re.test(line)) continue;
      findings.push({
        kind: pattern.kind,
        path: rel,
        line: index + 1,
        excerpt: line.trim().slice(0, 200),
        action: pattern.action,
      });
    }
  }
}

function featureArea(featurePath: string): string {
  const match = featurePath.match(/features\/([^/]+)\//);
  return match ? match[1] : 'other';
}

function hooksFor(featurePath: string, hooks: string[]): string[] {
  const area = featureArea(featurePath).toLowerCase();
  return hooks.filter(file => {
    const name = file.toLowerCase();
    if (name.includes('common-hooks') || name.includes('custom-world')) return true;
    if (area !== 'other' && name.includes(`${area}-hooks`)) return true;
    return false;
  }).sort();
}

function collectDataImports(absFile: string, sutRoot: string, cache: Map<string, string[]>): string[] {
  if (cache.has(absFile)) return cache.get(absFile) ?? [];
  if (!fs.existsSync(absFile)) {
    cache.set(absFile, []);
    return [];
  }
  const source = fs.readFileSync(absFile, 'utf8');
  const found = new Set<string>();
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null = importRe.exec(source);
  while (match) {
    const spec = match[1];
    if (/data|factory|fixture|storage/i.test(spec)) found.add(spec);
    match = importRe.exec(source);
  }
  const list = [...found].sort();
  cache.set(absFile, list);
  return list;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    const parent = this.parent.get(id) ?? id;
    if (parent !== id) {
      const root = this.find(parent);
      this.parent.set(id, root);
      return root;
    }
    return id;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groups(): string[][] {
    const buckets = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = buckets.get(root) ?? [];
      list.push(id);
      buckets.set(root, list);
    }
    return [...buckets.values()].map(group => group.sort());
  }
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as InventoryFile;
const sutRootField = typeof inventory.sut_root === 'string' ? inventory.sut_root : '';
const sutRoot = path.resolve(ROOT, sutRootField);
const hooks = Array.isArray(inventory.hooks)
  ? inventory.hooks.filter((entry): entry is string => typeof entry === 'string')
  : [];
const importCache = new Map<string, string[]>();
const antiPatterns: AntiPattern[] = [];
const coupling: CouplingRow[] = [];
const unboundSteps: Array<ScenarioRef & { keyword: string; text: string }> = [];
const skipped: Array<ScenarioRef & { tags: string[] }> = [];
const signatureMap = new Map<string, ScenarioRef[]>();
const tagCounts = new Map<string, number>();
const boundGlue = new Set<string>();

if (fs.existsSync(sutRoot)) {
  for (const tree of [
    path.join(sutRoot, 'packages/pom'),
    path.join(sutRoot, 'packages/cucumber-tests'),
  ]) {
    for (const file of walk(tree, '.ts')) scanFile(file, sutRoot, antiPatterns);
  }
}

for (const feature of inventory.features ?? []) {
  const featurePath = String(feature.path ?? '');
  const featureTags = asTags(feature.tags);
  for (const scenario of feature.scenarios ?? []) {
    const name = String(scenario.name ?? '');
    const tags = [...featureTags, ...asTags(scenario.tags)];
    for (const tag of tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    if (tags.some(tag => SKIP_TAGS.has(tag.toLowerCase()))) {
      skipped.push({ feature_path: featurePath, scenario: name, tags });
    }

    const steps = scenario.steps ?? [];
    const signature = steps
      .map(step => `${String(step.keyword ?? '')}|${String(step.text ?? '')}`)
      .join('\n');
    const refs = signatureMap.get(signature) ?? [];
    refs.push({ feature_path: featurePath, scenario: name });
    signatureMap.set(signature, refs);

    const glueModules = new Set<string>();
    let unbound = 0;
    for (const step of steps) {
      if (typeof step.glue === 'string') {
        boundGlue.add(step.glue);
        const modulePath = glueModule(step.glue);
        if (modulePath) glueModules.add(modulePath);
      } else {
        unbound += 1;
        unboundSteps.push({
          feature_path: featurePath,
          scenario: name,
          keyword: String(step.keyword ?? ''),
          text: String(step.text ?? ''),
        });
      }
    }

    const dataImports = new Set<string>();
    if (fs.existsSync(sutRoot)) {
      for (const modulePath of glueModules) {
        for (const spec of collectDataImports(path.join(sutRoot, modulePath), sutRoot, importCache)) {
          dataImports.add(spec);
        }
      }
    }

    const glueList = [...glueModules].sort();
    const hookFiles = hooksFor(featurePath, hooks);
    coupling.push({
      feature_path: featurePath,
      scenario: name,
      glue_modules: glueList,
      hook_files: hookFiles,
      data_imports: [...dataImports].sort(),
      unbound_step_count: unbound,
      coupling_depth: glueList.length + hookFiles.length,
      tags,
    });
  }
}

const duplicates = [...signatureMap.values()]
  .filter(group => group.length > 1)
  .map(scenarios => ({
    scenario_count: scenarios.length,
    scenarios,
  }));

const deadStepDefinitions: Array<{ path: string; line: number; pattern: string }> = [];
for (const definition of inventory.step_definitions ?? []) {
  const definitionPath = String(definition.path ?? '');
  for (const pattern of definition.patterns ?? []) {
    const line = Number(pattern.line);
    const key = `${definitionPath}:${line}`;
    if (boundGlue.has(key)) continue;
    deadStepDefinitions.push({
      path: definitionPath,
      line: Number.isInteger(line) ? line : 0,
      pattern: String(pattern.pattern ?? ''),
    });
  }
}

const featureGlue = new Map<string, Set<string>>();
for (const row of coupling) {
  const set = featureGlue.get(row.feature_path) ?? new Set<string>();
  for (const modulePath of row.glue_modules) {
    if (!INFRA_GLUE.test(modulePath)) set.add(modulePath);
  }
  featureGlue.set(row.feature_path, set);
}

const union = new UnionFind();
const featurePaths = [...featureGlue.keys()].sort();
for (const featurePath of featurePaths) union.add(featurePath);
for (let i = 0; i < featurePaths.length; i += 1) {
  for (let j = i + 1; j < featurePaths.length; j += 1) {
    const a = featurePaths[i];
    const b = featurePaths[j];
    const shared = [...(featureGlue.get(a) ?? [])].filter(modulePath =>
      (featureGlue.get(b) ?? new Set()).has(modulePath),
    );
    if (shared.length > 0) union.union(a, b);
  }
}

const scenariosByFeature = new Map<string, CouplingRow[]>();
for (const row of coupling) {
  const list = scenariosByFeature.get(row.feature_path) ?? [];
  list.push(row);
  scenariosByFeature.set(row.feature_path, list);
}

const proposedBatches = union.groups().sort((a, b) => a[0].localeCompare(b[0])).map((paths, index) => {
  const rows = paths.flatMap(featurePath => scenariosByFeature.get(featurePath) ?? []);
  const shared = new Set<string>();
  let depth = 0;
  for (const row of rows) {
    depth = Math.max(depth, row.coupling_depth);
    for (const modulePath of row.glue_modules) {
      if (!INFRA_GLUE.test(modulePath)) shared.add(modulePath);
    }
  }
  const sharedDependencies = [...shared].sort();
  const area = [...new Set(paths.map(featureArea))].sort().join(', ');
  return {
    id: `BATCH-${index + 1}`,
    scope_feature_paths: paths,
    scope_tags: null as null,
    case_ids: null as null,
    scenario_count: rows.length,
    coupling_depth: depth,
    shared_dependencies: sharedDependencies,
    rationale: sharedDependencies.length > 0
      ? `Features under ${area} share step modules ${sharedDependencies.join(', ')}`
      : `Feature ${paths.join(', ')} shares no exclusive step module with another feature`,
    review_estimate: {
      features: paths.length,
      scenarios: rows.length,
      glue_modules: sharedDependencies.length,
    },
  };
});

antiPatterns.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

const analysis = {
  inventory_sha256: sha256File(INVENTORY_PATH),
  sut_root: sutRootField,
  updated_at: new Date().toISOString(),
  unbound_step_count: unboundSteps.length,
  unbound_steps: unboundSteps,
  anti_patterns: antiPatterns,
  duplicates,
  skipped,
  dead_step_definitions: deadStepDefinitions,
  coupling,
  conventions: {
    tags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count })),
    hooks,
    feature_areas: [...new Set(featurePaths.map(featureArea))].sort().map(area => ({
      area,
      scenario_count: coupling.filter(row => featureArea(row.feature_path) === area).length,
    })),
  },
  proposed_batches: proposedBatches,
  baseline: null as null,
  baseline_reason: fs.existsSync(sutRoot)
    ? 'Legacy suite was not executed in this environment'
    : 'sut_root is not present on disk',
};

fs.writeFileSync(ANALYSIS_PATH, `${JSON.stringify(analysis, null, 2)}\n`);
process.stdout.write(
  `analysis: ${antiPatterns.length} anti-pattern(s), ` +
    `${unboundSteps.length} unbound step(s), ` +
    `${duplicates.length} duplicate group(s), ` +
    `${skipped.length} skipped scenario(s), ` +
    `${deadStepDefinitions.length} unbound definition(s), ` +
    `${proposedBatches.length} proposed batch(es)\n`,
);
