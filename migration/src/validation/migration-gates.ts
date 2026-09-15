/** Deterministic gates for the Cucumber-to-Playwright pipeline (ADR-015). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadMigrationRunState,
  migrationGenerationUnlocked,
  migrationStageIndex,
  runMigrationRunStateGates,
  MIGRATION_TEST_DIR,
} from './migration-run-state.js';
import type { MigrationBatch } from './migration-run-state.js';
import { runConfigGates } from './config-gates.js';
import { runHarnessChecksumGate } from './harness-checksum.js';
import { runVerdictGates } from './verdict-gates.js';
import { filesUnder, rel, ROOT, type GateResult } from './shared.js';

const INVENTORY_PATH = path.join(ROOT, 'data/inventory.json');
const ANALYSIS_PATH = path.join(ROOT, 'data/analysis.json');
const MAPPING_PATH = path.join(ROOT, 'data/mapping.json');
const DATA_DIR = path.join(ROOT, 'data');
const SUT_README = path.join(ROOT, 'sut/README.md');

const CASE_ID = /^MIG-\d+$/;
const BATCH_ID = /^BATCH-\d+$/;
const AUTOMATION_STATUS = new Set(['Automated', 'Not yet automated']);
const DECISIONS = new Set(['Automate', 'Manual-only', 'Defer', 'Drop']);
const VAGUE_RESULT = /\b(should work|correctly|as expected|properly)\b/i;
const ANTI_PATTERN_KINDS = new Set([
  'wait_for_timeout',
  'xpath_locator',
  'hashed_css',
  'boolean_literal_assertion',
  'boolean_pom_method',
  'visibility_probe_as_wait',
]);
const ANTI_PATTERN_ACTIONS = new Set(['do_not_copy', 'rewrite']);
const FORBIDDEN_IN_TARGET = [
  { kind: 'wait_for_timeout', re: /waitForTimeout\s*\(/ },
  { kind: 'xpath_locator', re: /xpath\s*=/i },
  { kind: 'hashed_css', re: /locator\(\s*['"][^'"]*css-[a-z0-9]+/i },
];

interface InventoryFeature {
  path?: unknown;
  name?: unknown;
  tags?: unknown;
  scenarios?: Array<{ name?: unknown; steps?: unknown; tags?: unknown }>;
}

interface InventoryFile {
  sut_root?: unknown;
  source_framework?: unknown;
  target_framework?: unknown;
  status?: unknown;
  reason?: unknown;
  escalate?: unknown;
  features?: InventoryFeature[];
}

interface MappingCase {
  id?: unknown;
  batch_id?: unknown;
  feature_path?: unknown;
  scenario?: unknown;
  decision?: unknown;
  drop_reason?: unknown;
  automation_status?: unknown;
  playwright?: unknown;
}

function sha256File(file: string): string {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return `sha256:${hash}`;
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

function loadJson(file: string, findings: string[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    findings.push(`${rel(file)}: unreadable JSON`);
    return null;
  }
}

/**
 * The legacy tree is an external input. `sut_root` on the inventory is the
 * single source of truth for where it lives; it may point outside the repo
 * (`../legacy-ta-framework`). Only imports are forbidden across that line.
 */
function resolveSutRoot(inventory: InventoryFile): string | null {
  const sutRoot = inventory.sut_root;
  if (typeof sutRoot !== 'string' || !sutRoot.trim()) return null;
  return path.resolve(ROOT, sutRoot);
}

/**
 * A copied legacy tree carries its own `node_modules`, and several Cucumber
 * packages ship `.feature` files as test fixtures. Those are vendor files,
 * not SUT scenarios — counting them makes an empty legacy suite look
 * populated. `cucumber-inventory` applies the same exclusion.
 */
function featureFilesUnderSut(sutRoot: string): string[] {
  return filesUnder(sutRoot, '.feature')
    .filter(file => !file.split(path.sep).includes('node_modules'));
}

function inventoryScenarioKeys(inventory: InventoryFile): Set<string> {
  const keys = new Set<string>();
  for (const feature of inventory.features ?? []) {
    const featurePath = String(feature.path ?? '');
    for (const scenario of feature.scenarios ?? []) {
      const name = String(scenario.name ?? '');
      if (featurePath && name) keys.add(`${featurePath}\0${name}`);
    }
  }
  return keys;
}

function asStringTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
}

function inventoryTagIndex(inventory: InventoryFile): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const feature of inventory.features ?? []) {
    const featurePath = String(feature.path ?? '');
    const featureTags = asStringTags(feature.tags);
    for (const scenario of feature.scenarios ?? []) {
      const name = String(scenario.name ?? '');
      if (!featurePath || !name) continue;
      index.set(`${featurePath}\0${name}`, [...featureTags, ...asStringTags(scenario.tags)]);
    }
  }
  return index;
}

function caseMatchesBatchScope(
  testCase: MappingCase,
  batch: MigrationBatch,
  tagsByScenario: Map<string, string[]>,
): boolean {
  const checks: boolean[] = [];
  const id = String(testCase.id ?? '');
  if (batch.case_ids) checks.push(batch.case_ids.includes(id));
  if (batch.scope_feature_paths) {
    checks.push(batch.scope_feature_paths.includes(String(testCase.feature_path ?? '')));
  }
  if (batch.scope_tags) {
    const tags = tagsByScenario.get(
      `${String(testCase.feature_path ?? '')}\0${String(testCase.scenario ?? '')}`,
    ) ?? [];
    checks.push(batch.scope_tags.some(tag => tags.includes(tag)));
  }
  return checks.length > 0 && checks.every(Boolean);
}

function validateInventory(findings: string[]): InventoryFile | null {
  const raw = loadJson(INVENTORY_PATH, findings);
  if (!raw || typeof raw !== 'object') return null;
  const inventory = raw as InventoryFile;
  const sutRoot = resolveSutRoot(inventory);
  if (!sutRoot) {
    findings.push('data/inventory.json: sut_root must be a non-empty path string');
  }
  if (inventory.source_framework !== 'cucumber') {
    findings.push('data/inventory.json: source_framework must be "cucumber"');
  }
  if (inventory.target_framework !== 'playwright') {
    findings.push('data/inventory.json: target_framework must be "playwright"');
  }
  const status = String(inventory.status ?? '');
  if (status !== 'WAITING' && status !== 'AUTO_PROCEED') {
    findings.push('data/inventory.json: status must be WAITING or AUTO_PROCEED');
  }
  // The SUT lives outside the repo, so a clean checkout (CI) has nothing to
  // compare against. Cross-check disk only when the tree is actually present.
  const sutPresent = sutRoot !== null && fs.existsSync(sutRoot);
  const featuresOnDisk = sutPresent ? featureFilesUnderSut(sutRoot) : [];
  if (status === 'WAITING') {
    if (typeof inventory.reason !== 'string' || !inventory.reason.trim()) {
      findings.push('data/inventory.json: WAITING requires a non-empty reason');
    }
    if (!Array.isArray(inventory.escalate) || inventory.escalate.length === 0) {
      findings.push('data/inventory.json: WAITING requires a non-empty escalate array');
    }
    if ((inventory.features ?? []).length > 0) {
      findings.push('data/inventory.json: WAITING cannot list features');
    }
    if (featuresOnDisk.length > 0) {
      findings.push(
        `data/inventory.json: status WAITING but ${featuresOnDisk.length} *.feature ` +
        `file(s) exist under ${String(inventory.sut_root)} — re-run cucumber-inventory`,
      );
    }
  } else {
    if (inventory.reason !== null) {
      findings.push('data/inventory.json: AUTO_PROCEED requires reason null');
    }
    if (inventory.escalate !== null) {
      findings.push('data/inventory.json: AUTO_PROCEED requires escalate null');
    }
    if (!Array.isArray(inventory.features) || inventory.features.length === 0) {
      findings.push('data/inventory.json: AUTO_PROCEED requires at least one feature');
    }
    if (sutPresent && featuresOnDisk.length === 0) {
      findings.push(
        `data/inventory.json: AUTO_PROCEED requires *.feature files under ${String(inventory.sut_root)}`,
      );
    }
    // Every inventoried feature must exist on disk. This is the check that
    // stops an invented feature path. Skipped when the tree is absent.
    if (sutPresent && sutRoot) {
      for (const [index, feature] of (inventory.features ?? []).entries()) {
        const featurePath = String(feature.path ?? '');
        if (!featurePath) continue;
        if (!fs.existsSync(path.join(sutRoot, featurePath))) {
          findings.push(
            `data/inventory.json: features[${index}].path "${featurePath}" ` +
            'does not exist under sut_root',
          );
        }
      }
    }
  }
  return inventory;
}

function validateAnalysis(inventory: InventoryFile | null, findings: string[]): void {
  if (!inventory || inventory.status !== 'AUTO_PROCEED') return;
  if (!fs.existsSync(ANALYSIS_PATH)) {
    findings.push('data/analysis.json: missing — run npm run scan:source');
    return;
  }
  const raw = loadJson(ANALYSIS_PATH, findings);
  if (!raw || typeof raw !== 'object') return;
  const analysis = raw as {
    inventory_sha256?: unknown;
    sut_root?: unknown;
    unbound_step_count?: unknown;
    anti_patterns?: unknown;
    baseline?: unknown;
  };
  const expected = sha256File(INVENTORY_PATH);
  if (analysis.inventory_sha256 !== expected) {
    findings.push(
      'data/analysis.json: inventory_sha256 is stale — re-run npm run scan:source',
    );
  }
  if (analysis.sut_root !== inventory.sut_root) {
    findings.push('data/analysis.json: sut_root must match data/inventory.json');
  }
  if (!Number.isInteger(analysis.unbound_step_count) ||
      Number(analysis.unbound_step_count) < 0) {
    findings.push('data/analysis.json: unbound_step_count must be a non-negative integer');
  }
  if (analysis.baseline !== null &&
      (typeof analysis.baseline !== 'object' || Array.isArray(analysis.baseline))) {
    findings.push('data/analysis.json: baseline must be an object or null');
  }
  if (!Array.isArray(analysis.anti_patterns)) {
    findings.push('data/analysis.json: anti_patterns must be an array');
    return;
  }
  for (const [index, hit] of analysis.anti_patterns.entries()) {
    const at = `data/analysis.json: anti_patterns[${index}]`;
    if (!hit || typeof hit !== 'object') {
      findings.push(`${at}: must be an object`);
      continue;
    }
    const row = hit as {
      kind?: unknown;
      path?: unknown;
      line?: unknown;
      excerpt?: unknown;
      action?: unknown;
    };
    if (typeof row.kind !== 'string' || !ANTI_PATTERN_KINDS.has(row.kind)) {
      findings.push(`${at}: kind is not a known anti-pattern`);
    }
    if (typeof row.path !== 'string' || !row.path.trim()) {
      findings.push(`${at}: path is required`);
    }
    if (!Number.isInteger(row.line) || Number(row.line) < 1) {
      findings.push(`${at}: line must be a positive integer`);
    }
    if (typeof row.excerpt !== 'string' || !row.excerpt.trim()) {
      findings.push(`${at}: excerpt is required`);
    }
    if (typeof row.action !== 'string' || !ANTI_PATTERN_ACTIONS.has(row.action)) {
      findings.push(`${at}: action must be do_not_copy or rewrite`);
    }
  }
}

function validateTargetDoesNotCopyAntiPatterns(findings: string[]): void {
  const dirs = [
    path.join(ROOT, 'pages'),
    path.join(ROOT, 'tests'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of filesUnder(dir, '.ts')) {
      const label = rel(file);
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const forbidden of FORBIDDEN_IN_TARGET) {
          if (!forbidden.re.test(line)) continue;
          findings.push(
            `${label}:${index + 1}: copied ${forbidden.kind} — rewrite; do not migrate this pattern`,
          );
        }
      });
    }
  }
}

function validateMapping(inventory: InventoryFile | null, findings: string[]): void {
  const raw = loadJson(MAPPING_PATH, findings);
  if (!raw || typeof raw !== 'object') return;
  const mapping = raw as { inventory_sha256?: unknown; cases?: MappingCase[] };
  const { state } = loadMigrationRunState();
  const pastMapping = state
    ? migrationStageIndex(state.stage) >= migrationStageIndex('0c_mapping')
    : false;

  if (mapping.inventory_sha256 !== null &&
      (typeof mapping.inventory_sha256 !== 'string' ||
        !/^sha256:[a-f0-9]{64}$/.test(mapping.inventory_sha256))) {
    findings.push(
      'data/mapping.json: inventory_sha256 must be sha256:<64 hex> or null',
    );
  }
  if (pastMapping) {
    const expected = sha256File(INVENTORY_PATH);
    if (mapping.inventory_sha256 !== expected) {
      findings.push(
        'data/mapping.json: inventory_sha256 is stale or missing — re-run cucumber-mapping',
      );
    }
  }
  if (!Array.isArray(mapping.cases)) {
    findings.push('data/mapping.json: cases must be an array');
    return;
  }

  const currentBatchId = state?.batch.id ?? null;
  const mappingComplete = Boolean(state && state.stages['0c_mapping'] === 'pass');
  const tagsByScenario = inventory ? inventoryTagIndex(inventory) : new Map<string, string[]>();
  const sources = inventory ? inventoryScenarioKeys(inventory) : new Set<string>();
  const ids = new Set<string>();
  const currentBatchCaseIds: string[] = [];
  const allowedSpecs = new Set<string>();
  const currentBatchSpecs = new Set<string>();
  const generationUnlocked = state ? migrationGenerationUnlocked(state) : false;

  for (const [index, testCase] of mapping.cases.entries()) {
    const at = `data/mapping.json: cases[${index}]`;
    const id = String(testCase.id ?? '');
    if (!CASE_ID.test(id)) findings.push(`${at}: id must match MIG-n`);
    else if (ids.has(id)) findings.push(`${at}: duplicate id ${id}`);
    else ids.add(id);
    const batchId = String(testCase.batch_id ?? '');
    if (!BATCH_ID.test(batchId)) {
      findings.push(`${at}: batch_id must match BATCH-n`);
    }
    const automationStatus = String(testCase.automation_status ?? '');
    if (!AUTOMATION_STATUS.has(automationStatus)) {
      findings.push(`${at}: automation_status must be Automated or Not yet automated`);
    }
    const decision = String(testCase.decision ?? '');
    if (!DECISIONS.has(decision)) {
      findings.push(`${at}: decision must be Automate, Manual-only, Defer, or Drop`);
    }
    const featurePath = String(testCase.feature_path ?? '');
    const scenario = String(testCase.scenario ?? '');
    if (!featurePath || !scenario) {
      findings.push(`${at}: feature_path and scenario are required`);
    } else if (inventory && !sources.has(`${featurePath}\0${scenario}`)) {
      findings.push(`${at}: scenario is not in data/inventory.json`);
    }
    const isCurrentBatch = currentBatchId !== null && batchId === currentBatchId;
    if (isCurrentBatch) currentBatchCaseIds.push(id);
    if (state && isCurrentBatch && !caseMatchesBatchScope(testCase, state.batch, tagsByScenario)) {
      findings.push(`${at}: case is outside the current batch scope`);
    }
    if (decision === 'Drop' || decision === 'Defer') {
      if (typeof testCase.drop_reason !== 'string' || !testCase.drop_reason.trim()) {
        findings.push(`${at}: ${decision} requires drop_reason`);
      }
    }
    if (decision === 'Drop' || decision === 'Defer' || decision === 'Manual-only') {
      if (testCase.playwright !== null) {
        findings.push(`${at}: ${decision} requires playwright null`);
      }
      if (automationStatus === 'Automated') {
        findings.push(`${at}: ${decision} cannot be Automated`);
      }
    }
    if (decision === 'Automate') {
      if (testCase.drop_reason !== null) {
        findings.push(`${at}: Automate requires drop_reason null`);
      }
      const expectAutomated = !isCurrentBatch || generationUnlocked;
      if (expectAutomated && automationStatus !== 'Automated') {
        findings.push(`${at}: completed Automate case requires automation_status Automated`);
      }
      if (!expectAutomated && automationStatus !== 'Not yet automated') {
        findings.push(`${at}: current-batch Automate case cannot be Automated before 1a_generation`);
      }
      if (!testCase.playwright || typeof testCase.playwright !== 'object') {
        findings.push(`${at}: Automate requires a playwright object`);
        continue;
      }
      const playwright = testCase.playwright as {
        spec?: unknown;
        test_title?: unknown;
        steps?: Array<{ action?: unknown; data?: unknown; result?: unknown }>;
      };
      const spec = String(playwright.spec ?? '');
      if (!spec.startsWith('tests/') || !spec.endsWith('.spec.ts')) {
        findings.push(`${at}: playwright.spec must be under tests/ and end in .spec.ts`);
      } else if (isCurrentBatch) {
        currentBatchSpecs.add(spec);
        if (generationUnlocked) allowedSpecs.add(spec);
      } else {
        allowedSpecs.add(spec);
      }
      if (typeof playwright.test_title !== 'string' || !playwright.test_title.trim()) {
        findings.push(`${at}: playwright.test_title is required`);
      }
      if (!Array.isArray(playwright.steps) || playwright.steps.length === 0) {
        findings.push(`${at}: playwright.steps must be a non-empty array`);
        continue;
      }
      for (const [stepIndex, step] of playwright.steps.entries()) {
        const stepAt = `${at}.steps[${stepIndex}]`;
        if (typeof step.action !== 'string' || !step.action.trim()) {
          findings.push(`${stepAt}: action is required`);
        }
        if (typeof step.data !== 'string' || !step.data.trim()) {
          findings.push(`${stepAt}: data must be "-" or a fixture handle`);
        }
        if (typeof step.result !== 'string' || !step.result.trim()) {
          findings.push(`${stepAt}: result is required`);
        } else if (VAGUE_RESULT.test(step.result)) {
          findings.push(`${stepAt}: result is too vague — copy the Gherkin Then`);
        }
      }
    }
  }

  if (mappingComplete && currentBatchId && currentBatchCaseIds.length === 0) {
    findings.push(
      'data/mapping.json: a completed 0c_mapping pass needs at least one case for the current batch',
    );
  }
  if (mappingComplete && state?.batch.case_ids) {
    for (const caseId of state.batch.case_ids) {
      if (!currentBatchCaseIds.includes(caseId)) {
        findings.push(
          `data/run-state.json: batch.case_ids includes ${caseId} which is not in the current batch mapping`,
        );
      }
    }
  }
  validateMigrationSpecs(allowedSpecs, currentBatchSpecs, generationUnlocked, findings);
}

function validateMigrationSpecs(
  allowedSpecs: Set<string>,
  currentBatchSpecs: Set<string>,
  generationUnlocked: boolean,
  findings: string[],
): void {
  const onDisk = filesUnder(MIGRATION_TEST_DIR, '.spec.ts').map(file =>
    rel(file).split(path.sep).join('/'),
  );
  for (const spec of onDisk) {
    if (!generationUnlocked && currentBatchSpecs.has(spec)) {
      findings.push(`${spec}: exists before stage 1a_generation for the current batch`);
      continue;
    }
    if (!allowedSpecs.has(spec)) {
      findings.push(
        generationUnlocked
          ? `${spec}: is not an Automate spec in data/mapping.json`
          : `${spec}: exists before stage 1a_generation`,
      );
    }
  }
  if (generationUnlocked) {
    for (const spec of currentBatchSpecs) {
      if (!onDisk.includes(spec)) {
        findings.push(`${spec}: missing after stage 1a_generation`);
      }
    }
  }
  for (const spec of allowedSpecs) {
    if (!currentBatchSpecs.has(spec) && !onDisk.includes(spec)) {
      findings.push(`${spec}: prior-batch spec is missing`);
    }
  }
}

function validateRunStateVsInventory(inventory: InventoryFile | null, findings: string[]): void {
  const { state } = loadMigrationRunState();
  if (!state || !inventory) return;
  const status = String(inventory.status ?? '');
  if (status === 'WAITING') {
    if (state.stages['0a_inventory'] !== 'waiting') {
      findings.push(
        'data/run-state.json: 0a_inventory must be waiting while inventory status is WAITING',
      );
    }
    if (state.stage !== '0a_inventory') {
      findings.push('data/run-state.json: cannot leave 0a while inventory status is WAITING');
    }
  } else if (migrationStageIndex(state.stage) > 0 && status !== 'AUTO_PROCEED') {
    findings.push(
      'data/run-state.json: stages after 0a require inventory status AUTO_PROCEED',
    );
  }
}

export function runMigrationGates(): string[] {
  const findings: string[] = [];
  if (!fs.existsSync(SUT_README)) {
    findings.push('sut/README.md: missing SUT location instructions');
  }
  for (const file of filesUnder(DATA_DIR, '.json')) {
    validateArtifactFormatting(file, findings);
  }
  findings.push(...runConfigGates());
  findings.push(...runHarnessChecksumGate());
  findings.push(...runVerdictGates());
  findings.push(...runMigrationRunStateGates());
  const inventory = validateInventory(findings);
  validateRunStateVsInventory(inventory, findings);
  validateAnalysis(inventory, findings);
  validateTargetDoesNotCopyAntiPatterns(findings);
  validateMapping(inventory, findings);
  return findings;
}

export function runMigrationGateResult(): GateResult {
  const findings = runMigrationGates();
  return { pass: findings.length === 0, findings };
}

const invokedAsScript = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  const result = runMigrationGateResult();
  if (result.pass) {
    process.stdout.write('migration gates: PASS\n');
  } else {
    process.stderr.write([
      `migration gates: FAIL (${result.findings.length})`,
      ...result.findings.map((finding, index) => `  ${index + 1}. ${finding}`),
      '',
    ].join('\n'));
    process.exitCode = 1;
  }
}
