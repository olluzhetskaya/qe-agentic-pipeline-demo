/**
 * Builds the read-only snapshot consumed by the optional review UI.
 * It reuses production parsers/gates; it does not reimplement verdict logic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureResolver } from '../validation/fixture-resolver.js';
import {
  runPipelineGates,
  type GateDirection,
} from '../validation/pipeline-gates.js';
import { ROOT } from '../validation/shared.js';
import { loadWikiCatalog } from '../validation/wiki-rules.js';

const OUTPUT = path.join(ROOT, 'review-ui/public/review-data.json');
const HANDLE = /\b[A-Z][A-Za-z0-9]*(?:\.[A-Za-z_][A-Za-z0-9]*)+\b/g;

interface DesignStep {
  data?: unknown;
}

interface DesignCase {
  preconditions?: unknown;
  steps?: DesignStep[];
}

interface TestDesign {
  test_cases?: DesignCase[];
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as unknown;
}

function handlesUsedByDesign(design: TestDesign): string[] {
  const handles = new Set<string>();
  for (const testCase of design.test_cases ?? []) {
    const sources = [
      ...(Array.isArray(testCase.preconditions) ? testCase.preconditions : []),
      ...(testCase.steps ?? []).map(step => step.data),
    ];
    for (const source of sources) {
      for (const match of String(source ?? '').matchAll(HANDLE)) handles.add(match[0]);
    }
  }
  return [...handles].sort();
}

const DIRECTIONS: Exclude<GateDirection, 'all'>[] = [
  'config', 'design', 'data', 'quality', 'verdicts',
];

/** Rebuilds the snapshot from the authoritative artifacts. Returns its repo path. */
export async function writeReviewSnapshot(): Promise<string> {
  const requirement = readJson('data/requirement.json');
  const design = readJson('data/test-design.json') as TestDesign;
  const wiki = loadWikiCatalog();
  const resolver = await loadFixtureResolver();

  const snapshot = {
    generated_at: new Date().toISOString(),
    read_only: true,
    sources: {
      requirement: 'data/requirement.json',
      design: 'data/test-design.json',
      run_state: 'data/run-state.json',
      wiki: 'wiki/',
    },
    gates: DIRECTIONS.map(direction => ({
      direction,
      ...runPipelineGates(direction),
    })),
    requirement,
    design,
    wiki: {
      rules: [...wiki.rules.values()].map(rule => ({
        slug: rule.slug,
        file: path.relative(ROOT, rule.file),
        techniques: [...rule.techniques],
        failure_modes: rule.failureModes,
        assertion: rule.assertion,
      })),
      sensitive_domains: wiki.sensitiveDomains,
      findings: wiki.findings,
    },
    fixture_resolutions: handlesUsedByDesign(design).map(handle => resolver.resolve(handle)),
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  return path.relative(ROOT, OUTPUT);
}

/** True once a human has generated the snapshot at least once. */
export function reviewSnapshotExists(): boolean {
  return fs.existsSync(OUTPUT);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`Review snapshot written to ${await writeReviewSnapshot()}\n`);
}
