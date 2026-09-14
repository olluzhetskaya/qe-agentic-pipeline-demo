/**
 * Quality gates — wiki-shaped checks a linter cannot express, enforced
 * as PASS/FAIL (not a prompt). Complements ESLint/ast-grep (syntax) and
 * the isolated judges (technique fit, invented scope).
 *
 *   1. Persisted AC grades on data/requirement.json (Stage 0a must land
 *      in the artifact, not only in chat).
 *   2. Failure-mode coverage on data/test-design.json, using each rule's
 *      wiki `Failure mode:` phrases.
 *   3. Per-test spec semantics under src/tests/ and golden_dataset/clean/:
 *      tautologies, each rule's wiki `Assertion:` contract, fixture scalar
 *      literals copied into a test.
 *   4. Golden locks: dirty-02 must fail an inversion contract and dirty-06
 *      must fail generic fixture-literal detection.
 *
 * No business rule text lives here. Slugs, failure phrases, and the
 * locator/matcher/precondition contracts all come from wiki/ via
 * loadWikiCatalog(); forbidden scalar literals are discovered from typed
 * fixture catalogs rather than from a domain-specific import.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  filesUnder,
  parseSource,
  rel,
  ROOT,
  typedRecordCatalog,
  unwrapExpression,
} from './shared.js';
import {
  assertConfidencePolicy,
  CONFIDENCE_THRESHOLD,
} from './confidence-policy.js';
import { loadWikiCatalog, type WikiCatalog } from './wiki-rules.js';

const REQUIREMENT_PATH = path.join(ROOT, 'data/requirement.json');
const DESIGN_PATH = path.join(ROOT, 'data/test-design.json');
const SPEC_DIR = path.join(ROOT, 'src/tests');
const DATA_DIR = path.join(ROOT, 'src/data');
const CLEAN_DIR = path.join(ROOT, 'golden_dataset/clean');
const DIRTY_02 = path.join(ROOT, 'golden_dataset/dirty/dirty-02.spec.ts');
const DIRTY_06 = path.join(ROOT, 'golden_dataset/dirty/dirty-06.spec.ts');

const AC_ID = /^AC-\d+$/;
const AC_TYPES = new Set(['deterministic', 'judge']);
const AC_GRADES = new Set(['PASS', 'FAIL', 'SKIP']);
const ANALYSIS_STATUSES = new Set(['AUTO_PROCEED', 'WAITING']);

const SKIP_TEST_METHODS = new Set([
  'describe', 'step', 'setTimeout', 'beforeEach', 'afterEach',
  'beforeAll', 'afterAll', 'extend', 'use', 'info',
]);

interface RequirementAc {
  id?: unknown;
  text?: unknown;
  type?: unknown;
  grade?: unknown;
  confidence?: unknown;
}

interface RequirementCache {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  raw_notes?: unknown;
  analysis_confidence?: {
    score?: unknown;
    threshold?: unknown;
    threshold_basis?: unknown;
    rationale?: unknown;
  };
  analysis_decision?: {
    status?: unknown;
    reason?: unknown;
    escalate?: unknown;
  };
  acceptance_criteria?: RequirementAc[];
}

interface DesignCase {
  id?: unknown;
  title?: unknown;
  linked_objective?: unknown;
  preconditions?: unknown;
  steps?: Array<{ action?: unknown; data?: unknown; result?: unknown }>;
}

interface DesignObjective {
  id?: unknown;
  wiki_rule?: unknown;
}

interface TestDesign {
  test_objectives?: DesignObjective[];
  test_cases?: DesignCase[];
}

function withoutComments(code: string): string {
  return code.replace(/\/\/[^\n]*/g, '');
}

function isSpecTestCall(node: ts.CallExpression): boolean {
  const expr = node.expression;
  if (ts.isIdentifier(expr) && expr.text === 'test') return true;
  if (!ts.isPropertyAccessExpression(expr)) return false;
  if (ts.isIdentifier(expr.expression) && expr.expression.text === 'test') {
    return !SKIP_TEST_METHODS.has(expr.name.text);
  }
  return false;
}

function testTitle(node: ts.CallExpression): string {
  const first = node.arguments[0];
  return first && ts.isStringLiteral(first) ? first.text : '(unnamed)';
}

function eachSpecTest(source: ts.SourceFile, visit: (title: string, body: string) => void): void {
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isSpecTestCall(node)) {
      const body = node.arguments[node.arguments.length - 1];
      if (body) visit(testTitle(node), body.getText(source));
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
}

/** All string values declared inside typed fixture catalogs under src/data/. */
function fixtureScalarLiterals(): Set<string> {
  const literals = new Set<string>();
  for (const file of filesUnder(DATA_DIR, '.ts')) {
    const source = parseSource(file);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!declaration.initializer) continue;
        const catalog = typedRecordCatalog(declaration.initializer);
        if (!catalog) continue;
        for (const entry of catalog.properties) {
          if (!ts.isPropertyAssignment(entry)) continue;
          const record = unwrapExpression(entry.initializer);
          if (!ts.isObjectLiteralExpression(record)) continue;
          for (const field of record.properties) {
            if (!ts.isPropertyAssignment(field)) continue;
            const value = unwrapExpression(field.initializer);
            if (ts.isStringLiteral(value) && value.text) literals.add(value.text);
          }
        }
      }
    }
  }
  return literals;
}

/** Does the body assert `matcher` on `locator` without first calling `requires`? */
function violatesAssertionContract(
  body: string,
  contract: { locator: string; matcher: string; requires: string },
): boolean {
  const asserted = body.indexOf(contract.locator);
  if (asserted < 0) return false;
  const window = body.slice(asserted, asserted + 120);
  return window.includes(contract.matcher) && !body.includes(contract.requires);
}

export function checkSpecSource(code: string, label: string, wiki?: WikiCatalog): string[] {
  const catalog = wiki ?? loadWikiCatalog();
  const fixtureLiterals = fixtureScalarLiterals();
  const source = ts.createSourceFile(label, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: string[] = [];

  eachSpecTest(source, (title, rawBody) => {
    const body = withoutComments(rawBody);
    const where = `${label} test "${title}"`;

    if (/\.toBeTruthy\(\)/.test(body)) {
      findings.push(`${where}: tautological assertion — assert an observable locator state (dirty-01)`);
    }

    for (const rule of catalog.rules.values()) {
      if (rule.assertion && violatesAssertionContract(body, rule.assertion)) {
        findings.push(
          `${where}: asserts ${rule.assertion.locator} ${rule.assertion.matcher} without ` +
          `${rule.assertion.requires} — inverts ${rule.slug} (dirty-02)`,
        );
      }
    }

    const copied = [...fixtureLiterals].filter(value =>
      body.includes(`'${value}'`) || body.includes(`"${value}"`));
    if (copied.length) {
      findings.push(
        `${where}: fixture scalar literal(s) ${copied.join(', ')} — read values through @fixtures (dirty-04, dirty-06)`,
      );
    }
  });

  return findings;
}

function checkSpecFile(file: string, wiki: WikiCatalog): string[] {
  return checkSpecSource(fs.readFileSync(file, 'utf8'), rel(file), wiki);
}

function caseBlob(testCase: DesignCase): string {
  const steps = (testCase.steps ?? [])
    .map(step => `${step.action ?? ''} ${step.data ?? ''} ${step.result ?? ''}`)
    .join(' ');
  const pre = Array.isArray(testCase.preconditions) ? testCase.preconditions.join(' ') : '';
  return `${testCase.title ?? ''} ${pre} ${steps}`;
}

function validateRequirementGrades(findings: string[]): void {
  let cached: RequirementCache;
  try {
    cached = JSON.parse(fs.readFileSync(REQUIREMENT_PATH, 'utf8')) as RequirementCache;
  } catch {
    findings.push('data/requirement.json: invalid JSON — Stage 0a quality cannot be gated');
    return;
  }

  const criteria = cached.acceptance_criteria;
  if (!Array.isArray(criteria) || criteria.length === 0) {
    findings.push('data/requirement.json: acceptance_criteria must be a non-empty array');
    return;
  }

  for (const field of ['title', 'description', 'raw_notes'] as const) {
    const value = cached[field];
    if (value !== null && (typeof value !== 'string' || !value.trim())) {
      findings.push(
        `data/requirement.json: ${field} must be a non-empty source string or null; never invent a sentinel`,
      );
    }
  }

  const handoff = cached.analysis_confidence;
  if (!handoff || !Number.isInteger(handoff.score) ||
      (handoff.score as number) < 0 || (handoff.score as number) > 100) {
    findings.push('data/requirement.json: analysis_confidence.score must be an integer from 0 to 100');
  }
  if (!handoff || typeof handoff.rationale !== 'string' || !handoff.rationale.trim()) {
    findings.push('data/requirement.json: analysis_confidence.rationale is required');
  }
  const threshold = handoff
    ? assertConfidencePolicy(handoff, 'data/requirement.json analysis_confidence', findings)
    : CONFIDENCE_THRESHOLD;

  const decision = cached.analysis_decision;
  const status = String(decision?.status ?? '');
  if (!ANALYSIS_STATUSES.has(status)) {
    findings.push('data/requirement.json: analysis_decision.status must be AUTO_PROCEED or WAITING');
  }
  if (status === 'AUTO_PROCEED') {
    if (decision?.reason !== null) {
      findings.push('data/requirement.json: AUTO_PROCEED requires analysis_decision.reason null');
    }
    if (decision?.escalate !== null) {
      findings.push('data/requirement.json: AUTO_PROCEED requires analysis_decision.escalate null');
    }
  }
  if (status === 'WAITING') {
    if (typeof decision?.reason !== 'string' || !decision.reason.trim()) {
      findings.push('data/requirement.json: WAITING requires a non-empty analysis_decision.reason');
    }
    if (!Array.isArray(decision?.escalate) || decision.escalate.length === 0) {
      findings.push('data/requirement.json: WAITING requires a non-empty analysis_decision.escalate array');
    } else {
      for (const [index, item] of decision.escalate.entries()) {
        if (typeof item !== 'string' || !item.trim()) {
          findings.push(`data/requirement.json: analysis_decision.escalate[${index}] must be a non-empty string`);
        }
      }
    }
  }

  const score = typeof handoff?.score === 'number' ? handoff.score : null;
  let mustWait = score !== null && score < threshold;
  let deterministicPass = 0;
  let deterministicFail = false;
  for (const [index, criterion] of criteria.entries()) {
    const label = `data/requirement.json AC ${index + 1}`;
    const id = typeof criterion.id === 'string' ? criterion.id : '';
    if (!AC_ID.test(id)) findings.push(`${label}: id must match AC-N`);
    if (typeof criterion.text !== 'string' || !criterion.text.trim()) {
      findings.push(`${label}: text is required`);
    }
    const type = String(criterion.type);
    const grade = String(criterion.grade);
    if (!AC_TYPES.has(type)) {
      findings.push(`${label}: type must be deterministic or judge`);
    }
    if (!AC_GRADES.has(grade)) {
      findings.push(`${label}: grade must be PASS, FAIL, or SKIP (persist 0a quality in the cache)`);
      continue;
    }
    if (!Number.isInteger(criterion.confidence) ||
        (criterion.confidence as number) < 0 || (criterion.confidence as number) > 100) {
      findings.push(`${label}: confidence must be an integer from 0 to 100`);
    } else if ((criterion.confidence as number) < threshold) {
      mustWait = true;
    }
    if (type === 'deterministic') {
      if (grade === 'SKIP') {
        findings.push(`${label}: deterministic ACs cannot be SKIP`);
      }
      if (grade === 'FAIL') {
        deterministicFail = true;
        mustWait = true;
      }
      if (grade === 'PASS') deterministicPass += 1;
    }
    if (type === 'judge' && grade !== 'SKIP') {
      findings.push(`${label}: judge/NFR ACs must be SKIP — they are not automation candidates`);
    }
  }
  if (mustWait && status === 'AUTO_PROCEED') {
    findings.push(
      `data/requirement.json: AUTO_PROCEED is incompatible with confidence below ${threshold} or a deterministic FAIL`,
    );
  }
  if (status === 'AUTO_PROCEED' && (deterministicPass === 0 || deterministicFail)) {
    findings.push('data/requirement.json: AUTO_PROCEED requires at least one deterministic PASS and no deterministic FAIL');
  }
}

function validateDesignFailureModes(wiki: WikiCatalog, findings: string[]): void {
  let design: TestDesign;
  try {
    design = JSON.parse(fs.readFileSync(DESIGN_PATH, 'utf8')) as TestDesign;
  } catch {
    return;
  }

  const objectives = design.test_objectives ?? [];
  const cases = design.test_cases ?? [];

  for (const objective of objectives) {
    const rule = wiki.rules.get(String(objective.wiki_rule ?? ''));
    if (!rule || rule.failureModes.length === 0) continue;
    const linked = cases.filter(testCase => testCase.linked_objective === objective.id);
    const covered = linked.some(testCase => {
      const blob = caseBlob(testCase).toLowerCase();
      return rule.failureModes.some(phrase => blob.includes(phrase.toLowerCase()));
    });
    if (!covered) {
      findings.push(
        `data/test-design.json: wiki rule "${rule.slug}" has no failure-mode case ` +
        `(expected one of: ${rule.failureModes.join(', ')})`,
      );
    }
  }
}

function validateSpecs(wiki: WikiCatalog, findings: string[]): void {
  for (const file of [...filesUnder(SPEC_DIR, '.spec.ts'), ...filesUnder(CLEAN_DIR, '.spec.ts')]) {
    findings.push(...checkSpecFile(file, wiki));
  }

  if (!fs.existsSync(DIRTY_02)) {
    findings.push(`${rel(DIRTY_02)}: missing — quality gate cannot lock dirty-02`);
    return;
  }
  const dirtyFindings = checkSpecFile(DIRTY_02, wiki);
  if (!dirtyFindings.some(finding => finding.includes('inverts '))) {
    findings.push(
      'quality-gates: dirty-02 no longer fails an inversion contract — the quality bar regressed',
    );
  }

  if (!fs.existsSync(DIRTY_06)) {
    findings.push(`${rel(DIRTY_06)}: missing — quality gate cannot lock fixture-literal detection`);
    return;
  }
  const fixtureLiteralFindings = checkSpecFile(DIRTY_06, wiki);
  if (!fixtureLiteralFindings.some(finding => finding.includes('fixture scalar literal'))) {
    findings.push(
      'quality-gates: dirty-06 no longer fails fixture-literal detection — the quality bar regressed',
    );
  }
}

export function runQualityGates(): string[] {
  const wiki = loadWikiCatalog();
  const findings: string[] = [];
  validateRequirementGrades(findings);
  validateDesignFailureModes(wiki, findings);
  validateSpecs(wiki, findings);
  return findings;
}
