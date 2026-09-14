/** Deterministic test-design traceability against the wiki catalog. */
import fs from 'node:fs';
import path from 'node:path';
import { collectFixtureHandles, ROOT } from './shared.js';
import { generationUnlocked, loadRunState } from './run-state.js';
import { canonicalTechnique, loadWikiCatalog, type WikiCatalog } from './wiki-rules.js';
import {
  alignManualCasesWithCatalogue,
  catalogueMatchesRequirement,
  loadXrayIndex,
} from './xray-index.js';

const DESIGN_PATH = path.join(ROOT, 'data/test-design.json');
const REQUIREMENT_PATH = path.join(ROOT, 'data/requirement.json');

interface Objective {
  id?: unknown;
  name?: unknown;
  requirement_id?: unknown;
  covers_ac?: unknown;
  wiki_rule?: unknown;
  automation_candidacy?: unknown;
  notes?: unknown;
}

interface AcceptanceCriterion {
  id?: unknown;
  type?: unknown;
  text?: unknown;
}

/**
 * Which acceptance criteria an objective may claim. `inScope` are the
 * automation candidates; the requirement artifact decides the type, not this gate.
 */
interface CriteriaIndex {
  all: Set<string>;
  inScope: Set<string>;
  typeById: Map<string, string>;
  textById: Map<string, string>;
}

interface TestStep {
  action?: unknown;
  data?: unknown;
  result?: unknown;
}

interface TestCase {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  test_type?: unknown;
  linked_objective?: unknown;
  requirement_id?: unknown;
  covers_ac?: unknown;
  ac_text?: unknown;
  technique?: unknown;
  steps?: TestStep[];
  automation_status?: unknown;
  automated_by?: unknown;
  notes?: unknown;
  xray_key?: unknown;
  preconditions?: unknown;
}

interface TestDesign {
  requirement_id?: unknown;
  project_key?: unknown;
  test_objectives?: Objective[];
  test_cases?: TestCase[];
}

const PLACEHOLDER = /\{[^{}]{1,80}\}|<[^<>]{1,80}>/;
const VAGUE_RESULT = /\b(should work|correctly|as expected|properly)\b/i;
const OBJECTIVE_ID = /^OBJ-\d+$/;
const CASE_ID = /^TC-\d+$/;
const OBJECTIVE_CANDIDACY = new Set(['Automate', 'Manual-only', 'Defer']);
const AUTOMATION_STATUS = new Set(['Automated', 'Not yet automated']);
const PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const NO_INPUT = '-';
const PRODUCED_SPEC = /^src\/tests\/.+\.spec\.ts$/;
/** Mirrors the AC vocabulary graded by the quality gate. */
const AUTOMATABLE_AC_TYPE = 'deterministic';
/** Catalog.key or Catalog.key.field — never a copied fixture value. */
const FIXTURE_HANDLE = /\b[A-Z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9]*)+\b/g;

function fixtureHandlesIn(raw: string): string[] {
  return [...raw.matchAll(new RegExp(FIXTURE_HANDLE.source, 'g'))].map(match => match[0]);
}

function assertKnownHandle(raw: string, label: string, handles: Set<string>, findings: string[]): void {
  for (const handle of fixtureHandlesIn(raw)) {
    if (!handles.has(handle)) {
      findings.push(`${label}: unknown fixture handle "${handle}" — must exist under src/data/`);
    }
  }
}

function requiredString(value: unknown, label: string, findings: string[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    findings.push(`${label} is required`);
    return '';
  }
  return value;
}

function validateStepData(data: unknown, label: string, handles: Set<string>, findings: string[]): void {
  if (data === undefined || data === null || data === '') {
    findings.push(`${label}: data is required; use "-" for no input`);
    return;
  }
  const value = String(data);
  if (PLACEHOLDER.test(value)) {
    findings.push(`${label}: placeholder data is forbidden`);
    return;
  }
  if (value === NO_INPUT) return;
  const listed = fixtureHandlesIn(value);
  if (listed.length !== 1 || listed[0] !== value) {
    findings.push(
      `${label}: data must be "-" or one src/data/ handle (e.g. Tenants.growth01.id), not a copied value`,
    );
    return;
  }
  assertKnownHandle(value, label, handles, findings);
}

function validateSteps(
  testCase: TestCase,
  label: string,
  handles: Set<string>,
  findings: string[],
): void {
  if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
    findings.push(`${label}: steps must be a non-empty array`);
    return;
  }
  for (const [stepIndex, step] of testCase.steps.entries()) {
    const stepLabel = `${label} step ${stepIndex + 1}`;
    requiredString(step.action, `${stepLabel}: action`, findings);
    validateStepData(step.data, `${stepLabel}: data`, handles, findings);
    const result = requiredString(step.result, `${stepLabel}: result`, findings);
    if (result && VAGUE_RESULT.test(result)) findings.push(`${stepLabel}: result is vague`);
  }
}

function validateCoverage(
  objective: Objective,
  label: string,
  criteria: CriteriaIndex,
  coveredCriteria: Set<string>,
  findings: string[],
): void {
  if (!Array.isArray(objective.covers_ac)) {
    findings.push(
      `${label}: covers_ac must be an array of acceptance-criterion ids, [] if the objective derives from a wiki rule alone`,
    );
    return;
  }
  for (const raw of objective.covers_ac) {
    const criterionId = String(raw);
    if (!criteria.all.has(criterionId)) {
      findings.push(`${label}: covers_ac "${criterionId}" is not an acceptance criterion in data/requirement.json`);
      continue;
    }
    if (!criteria.inScope.has(criterionId)) {
      findings.push(
        `${label}: covers_ac "${criterionId}" is type "${criteria.typeById.get(criterionId) ?? 'null'}" — not an automation candidate, so it cannot be claimed as covered`,
      );
      continue;
    }
    coveredCriteria.add(criterionId);
  }
  if (objective.covers_ac.length === 0 && !String(objective.notes ?? '').trim()) {
    findings.push(
      `${label}: covers_ac is empty — notes must state why the objective exists without an acceptance criterion`,
    );
  }
}

/** A case may claim any subset of its objective's criteria — never more. */
function validateCaseCoverage(
  testCase: TestCase,
  label: string,
  objective: Objective | undefined,
  caseCoverage: Map<string, Set<string>>,
  criteria: CriteriaIndex,
  findings: string[],
): void {
  const objectiveId = String(testCase.linked_objective);
  const claimed = new Set(
    (Array.isArray(objective?.covers_ac) ? objective.covers_ac : []).map(String),
  );
  if (!Array.isArray(testCase.covers_ac)) {
    findings.push(`${label}: covers_ac must be an array of acceptance-criterion ids`);
    return;
  }
  for (const raw of testCase.covers_ac) {
    const criterionId = String(raw);
    if (!claimed.has(criterionId)) {
      findings.push(
        `${label}: covers_ac "${criterionId}" is not claimed by ${objectiveId} — a case cannot cover more than its objective`,
      );
      continue;
    }
    const exercised = caseCoverage.get(objectiveId) ?? new Set<string>();
    exercised.add(criterionId);
    caseCoverage.set(objectiveId, exercised);
  }
  if (testCase.covers_ac.length === 0 && claimed.size > 0) {
    findings.push(
      `${label}: covers_ac is empty although ${objectiveId} claims ${[...claimed].join(', ')}`,
    );
  }
  if (!Array.isArray(testCase.ac_text)) {
    findings.push(`${label}: ac_text must copy each covers_ac criterion text from data/requirement.json`);
    return;
  }
  if (testCase.ac_text.length !== testCase.covers_ac.length) {
    findings.push(`${label}: ac_text length must equal covers_ac length`);
    return;
  }
  for (const [index, raw] of testCase.covers_ac.entries()) {
    const criterionId = String(raw);
    const expected = criteria.textById.get(criterionId);
    const copied = testCase.ac_text[index];
    if (typeof copied !== 'string' || copied !== expected) {
      findings.push(
        `${label}: ac_text[${index}] must equal data/requirement.json text for ${criterionId}`,
      );
    }
  }
}

function validateObjective(
  objective: Objective,
  index: number,
  requirementId: string,
  storyRules: Set<string>,
  ids: Set<string>,
  claimedRules: Set<string>,
  criteria: CriteriaIndex,
  coveredCriteria: Set<string>,
  findings: string[],
): void {
  const label = `data/test-design.json objective ${index + 1}`;
  const id = requiredString(objective.id, `${label}: id`, findings);
  requiredString(objective.name, `${label}: name`, findings);
  if (id && !OBJECTIVE_ID.test(id)) findings.push(`${label}: id must match OBJ-N`);
  if (id && ids.has(id)) findings.push(`${label}: duplicate id "${id}"`);
  ids.add(id);
  if (objective.requirement_id !== requirementId) {
    findings.push(`${label}: requirement_id must equal top-level "${requirementId}"`);
  }
  // Scope comes from the story's wiki_refs. The wiki is the whole domain's
  // standing knowledge, so it cannot dictate what one story must verify.
  if (typeof objective.wiki_rule !== 'string' || !storyRules.has(objective.wiki_rule)) {
    findings.push(
      `${label}: wiki_rule must be one of the wiki_refs declared in data/requirement.json`,
    );
  } else {
    if (claimedRules.has(objective.wiki_rule)) {
      findings.push(`${label}: wiki_rule "${objective.wiki_rule}" already has an objective`);
    }
    claimedRules.add(objective.wiki_rule);
  }
  if (!OBJECTIVE_CANDIDACY.has(String(objective.automation_candidacy))) {
    findings.push(`${label}: automation_candidacy must be Automate, Manual-only, or Defer`);
  }
  validateCoverage(objective, label, criteria, coveredCriteria, findings);
}

function validateCase(
  testCase: TestCase,
  index: number,
  requirementId: string,
  objectivesById: Map<string, Objective>,
  caseIds: Set<string>,
  wiki: WikiCatalog,
  handles: Set<string>,
  caseCoverage: Map<string, Set<string>>,
  criteria: CriteriaIndex,
  requireXrayKey: boolean,
  findings: string[],
): void {
  const label = `data/test-design.json case ${index + 1}`;
  const id = requiredString(testCase.id, `${label}: id`, findings);
  requiredString(testCase.title, `${label}: title`, findings);
  if (id && !CASE_ID.test(id)) findings.push(`${label}: id must match TC-N`);
  if (id && caseIds.has(id)) findings.push(`${label}: duplicate id "${id}"`);
  caseIds.add(id);
  if (testCase.requirement_id !== requirementId) {
    findings.push(`${label}: requirement_id must equal top-level "${requirementId}"`);
  }
  if (!objectivesById.has(String(testCase.linked_objective))) {
    findings.push(`${label}: linked_objective does not exist`);
  } else {
    validateCaseCoverage(
      testCase, label, objectivesById.get(String(testCase.linked_objective)),
      caseCoverage, criteria, findings,
    );
  }
  if (!Array.isArray(testCase.technique) || testCase.technique.length === 0) {
    findings.push(`${label}: technique must be a non-empty array`);
  } else {
    const used = new Set<string>();
    for (const raw of testCase.technique) {
      const technique = canonicalTechnique(String(raw));
      if (!technique) {
        findings.push(`${label}: unknown technique "${String(raw)}"`);
        continue;
      }
      used.add(technique);
    }
    const objective = objectivesById.get(String(testCase.linked_objective));
    const allowed = typeof objective?.wiki_rule === 'string'
      ? wiki.rules.get(objective.wiki_rule)?.techniques
      : undefined;
    if (allowed && used.size > 0 && ![...used].some(technique => allowed.has(technique))) {
      findings.push(
        `${label}: technique must include one of the wiki Design approaches for "${String(objective?.wiki_rule)}"`,
      );
    }
  }
  if (!PRIORITIES.has(String(testCase.priority))) {
    findings.push(`${label}: priority must be Critical, High, Medium, or Low`);
  }
  if (testCase.test_type !== 'Manual') findings.push(`${label}: test_type must be Manual`);
  if (Array.isArray(testCase.preconditions)) {
    for (const [index, precondition] of testCase.preconditions.entries()) {
      assertKnownHandle(String(precondition), `${label} precondition ${index + 1}`, handles, findings);
    }
  }
  validateSteps(testCase, label, handles, findings);

  const status = String(testCase.automation_status);
  if (!AUTOMATION_STATUS.has(status)) {
    findings.push(`${label}: automation_status must be Automated or Not yet automated`);
  } else if (status === 'Automated') {
    if (typeof testCase.automated_by !== 'string' || !PRODUCED_SPEC.test(testCase.automated_by)) {
      findings.push(`${label}: Automated requires automated_by under src/tests/*.spec.ts`);
    } else if (!fs.existsSync(path.join(ROOT, testCase.automated_by))) {
      findings.push(`${label}: automated_by path does not exist`);
    }
  } else {
    if (testCase.automated_by !== null) {
      findings.push(`${label}: Not yet automated requires automated_by null — golden_dataset is calibration, not traceability`);
    }
    if (typeof testCase.notes !== 'string' || !testCase.notes.trim()) {
      findings.push(`${label}: Not yet automated requires notes`);
    }
  }
  if (requireXrayKey) {
    if (typeof testCase.xray_key !== 'string' || !testCase.xray_key.trim()) {
      findings.push(`${label}: xray_key is required once the Xray catalogue matches or Stage 0e/1a is unlocked`);
    }
  } else if (testCase.xray_key !== null && testCase.xray_key !== undefined &&
      (typeof testCase.xray_key !== 'string' || !testCase.xray_key.trim())) {
    findings.push(`${label}: xray_key must be null or a non-empty issue key`);
  }
}

/** Automation scope comes from the AC type recorded in Stage 0a. */
function indexCriteria(raw: unknown, findings: string[]): CriteriaIndex {
  const index: CriteriaIndex = {
    all: new Set(), inScope: new Set(), typeById: new Map(), textById: new Map(),
  };
  if (!Array.isArray(raw)) {
    findings.push('data/requirement.json: acceptance_criteria must be an array');
    return index;
  }
  for (const criterion of raw as AcceptanceCriterion[]) {
    if (typeof criterion?.id !== 'string' || !criterion.id.trim()) continue;
    const type = String(criterion.type);
    index.all.add(criterion.id);
    index.typeById.set(criterion.id, type);
    if (typeof criterion.text === 'string') index.textById.set(criterion.id, criterion.text);
    if (type === AUTOMATABLE_AC_TYPE) index.inScope.add(criterion.id);
  }
  return index;
}

function validateDesign(wiki: WikiCatalog, findings: string[]): void {
  let design: TestDesign;
  let cachedRequirement: { id?: unknown; wiki_refs?: unknown; acceptance_criteria?: unknown };
  try {
    design = JSON.parse(fs.readFileSync(DESIGN_PATH, 'utf8')) as TestDesign;
    cachedRequirement = JSON.parse(fs.readFileSync(REQUIREMENT_PATH, 'utf8')) as {
      id?: unknown;
      wiki_refs?: unknown;
      acceptance_criteria?: unknown;
    };
  } catch {
    findings.push('data/: requirement.json and test-design.json must be valid JSON');
    return;
  }

  const requirementId = requiredString(
    design.requirement_id,
    'data/test-design.json: requirement_id',
    findings,
  );
  if (requirementId && cachedRequirement.id !== requirementId) {
    findings.push('data/test-design.json: requirement_id must match data/requirement.json');
  }
  if (typeof design.project_key !== 'string' ||
      !requirementId.startsWith(`${design.project_key}-`)) {
    findings.push('data/test-design.json: project_key must match requirement_id prefix');
  }
  const storyRules = new Set<string>();
  if (!Array.isArray(cachedRequirement.wiki_refs)) {
    findings.push('data/requirement.json: wiki_refs must be an array');
  } else {
    for (const ref of cachedRequirement.wiki_refs) {
      if (typeof ref !== 'string' || !wiki.slugs.has(ref)) {
        findings.push(`data/requirement.json: unknown wiki_ref "${String(ref)}"`);
        continue;
      }
      storyRules.add(ref);
    }
  }

  const objectives = design.test_objectives ?? [];
  const cases = design.test_cases ?? [];
  if (objectives.length === 0) findings.push('data/test-design.json: test_objectives is empty');
  if (cases.length === 0) findings.push('data/test-design.json: test_cases is empty');
  const objectiveIds = new Set<string>();
  const objectivesById = new Map<string, Objective>();
  const caseIds = new Set<string>();
  const claimedRules = new Set<string>();
  const handles = collectFixtureHandles();
  const criteria = indexCriteria(cachedRequirement.acceptance_criteria, findings);
  const coveredCriteria = new Set<string>();

  objectives.forEach((objective, index) => {
    validateObjective(
      objective, index, requirementId, storyRules, objectiveIds, claimedRules,
      criteria, coveredCriteria, findings,
    );
    if (typeof objective.id === 'string') objectivesById.set(objective.id, objective);
  });
  const caseCoverage = new Map<string, Set<string>>();
  const { state } = loadRunState();
  const loadedIndex = loadXrayIndex();
  findings.push(...loadedIndex.findings);
  const catalogue = loadedIndex.index;
  const indexMatches = Boolean(
    catalogue &&
    requirementId &&
    typeof design.project_key === 'string' &&
    catalogueMatchesRequirement(catalogue, requirementId, design.project_key),
  );
  if (loadedIndex.present && catalogue && requirementId && !indexMatches) {
    findings.push(
      'data/xray-index.json: requirement_id and project_key must match data/test-design.json',
    );
  }
  const requireXrayKey = Boolean(
    (state && (generationUnlocked(state) || state.stages['0e_xray_publish'] === 'pass')) ||
    indexMatches,
  );
  if (catalogue && indexMatches) {
    alignManualCasesWithCatalogue(catalogue, cases, findings);
  }
  cases.forEach((testCase, caseIndex) => validateCase(
    testCase, caseIndex, requirementId, objectivesById, caseIds, wiki, handles,
    caseCoverage, criteria, requireXrayKey, findings,
  ));

  for (const objectiveId of objectiveIds) {
    if (!cases.some(testCase => testCase.linked_objective === objectiveId)) {
      findings.push(`data/test-design.json: objective "${objectiveId}" has no test case`);
    }
  }
  for (const objective of objectives) {
    const objectiveId = String(objective.id);
    const exercised = caseCoverage.get(objectiveId) ?? new Set<string>();
    const claimed = Array.isArray(objective.covers_ac) ? objective.covers_ac : [];
    for (const raw of claimed) {
      if (!exercised.has(String(raw))) {
        findings.push(
          `data/test-design.json: objective "${objectiveId}" claims ${String(raw)} but no linked case exercises it`,
        );
      }
    }
  }
  for (const criterionId of criteria.inScope) {
    if (!coveredCriteria.has(criterionId)) {
      findings.push(
        `data/requirement.json: acceptance criterion "${criterionId}" is an automation candidate with no test objective`,
      );
    }
  }
}

export function runDesignGates(): string[] {
  const wiki = loadWikiCatalog();
  const findings = [...wiki.findings];
  validateDesign(wiki, findings);
  return findings;
}
