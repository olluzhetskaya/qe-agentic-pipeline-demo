/** Resumable pointer for the Cucumber-to-Playwright pipeline (ADR-015). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './shared.js';

export const MIGRATION_RUN_STATE_PATH = path.join(ROOT, 'data/run-state.json');
export const MIGRATION_TEST_DIR = path.join(ROOT, 'tests');

export const MIGRATION_STAGES = [
  '0a_inventory',
  '0b_coverage',
  '0c_mapping',
  '0d_mapping_review',
  '1a_generation',
  '1b_code_review',
  '1c_pr_draft',
] as const;

export type MigrationStage = typeof MIGRATION_STAGES[number];
export type MigrationStageStatus = 'pending' | 'pass' | 'fail' | 'waiting';

export interface MigrationBatch {
  id: string | null;
  scope_feature_paths: string[] | null;
  scope_tags: string[] | null;
  case_ids: string[] | null;
}

export interface MigrationRunState {
  pipeline: 'cucumber-to-playwright';
  stage: MigrationStage;
  updated_at: string;
  stages: Record<MigrationStage, MigrationStageStatus>;
  batch: MigrationBatch;
}

const STATUSES = new Set<MigrationStageStatus>(['pending', 'pass', 'fail', 'waiting']);
const BATCH_ID = /^BATCH-\d+$/;

function parseStringList(value: unknown, label: string, findings: string[]): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length === 0) {
    findings.push(`${label} must be a non-empty string array or null`);
    return null;
  }
  const items: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !entry.trim()) {
      findings.push(`${label}[${index}] must be a non-empty string`);
      continue;
    }
    items.push(entry);
  }
  return items.length === value.length ? items : null;
}

function parseBatch(record: Record<string, unknown>, findings: string[]): MigrationBatch | null {
  if (!record.batch || typeof record.batch !== 'object' || Array.isArray(record.batch)) {
    findings.push('data/run-state.json: batch must be an object');
    return null;
  }
  const batch = record.batch as Record<string, unknown>;
  const before = findings.length;
  if (batch.id !== null && (typeof batch.id !== 'string' || !BATCH_ID.test(batch.id))) {
    findings.push('data/run-state.json: batch.id must be BATCH-n or null');
  }
  const scope_feature_paths = parseStringList(
    batch.scope_feature_paths,
    'data/run-state.json: batch.scope_feature_paths',
    findings,
  );
  const scope_tags = parseStringList(
    batch.scope_tags,
    'data/run-state.json: batch.scope_tags',
    findings,
  );
  const case_ids = parseStringList(
    batch.case_ids,
    'data/run-state.json: batch.case_ids',
    findings,
  );
  if (findings.length > before) return null;
  const id = batch.id === null ? null : String(batch.id);
  if (id !== null &&
      scope_feature_paths === null &&
      scope_tags === null &&
      case_ids === null) {
    findings.push(
      'data/run-state.json: a named batch needs scope_feature_paths, scope_tags, or case_ids',
    );
    return null;
  }
  return { id, scope_feature_paths, scope_tags, case_ids };
}

export function migrationStageIndex(stage: string): number {
  return (MIGRATION_STAGES as readonly string[]).indexOf(stage);
}

export function migrationGenerationUnlocked(state: MigrationRunState): boolean {
  return migrationStageIndex(state.stage) >= migrationStageIndex('1a_generation');
}

export function loadMigrationRunState(): { state: MigrationRunState | null; findings: string[] } {
  const findings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(MIGRATION_RUN_STATE_PATH, 'utf8')) as unknown;
  } catch {
    return { state: null, findings: ['data/run-state.json: missing or invalid JSON'] };
  }
  if (!raw || typeof raw !== 'object') {
    return { state: null, findings: ['data/run-state.json: must be an object'] };
  }
  const record = raw as Record<string, unknown>;
  if (record.pipeline !== 'cucumber-to-playwright') {
    findings.push('data/run-state.json: pipeline must be "cucumber-to-playwright"');
  }
  if (typeof record.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.updated_at)) {
    findings.push('data/run-state.json: updated_at must be an ISO-8601 timestamp');
  }
  const stage = String(record.stage ?? '');
  if (!MIGRATION_STAGES.includes(stage as MigrationStage)) {
    findings.push(
      `data/run-state.json: stage must be one of ${MIGRATION_STAGES.join(', ')}`,
    );
  }
  if (!record.stages || typeof record.stages !== 'object') {
    findings.push('data/run-state.json: stages must be an object');
    return { state: null, findings };
  }
  const stages = record.stages as Record<string, unknown>;
  for (const name of MIGRATION_STAGES) {
    const status = stages[name];
    if (!STATUSES.has(status as MigrationStageStatus)) {
      findings.push(
        `data/run-state.json: stages.${name} must be pending, pass, fail, or waiting`,
      );
    }
  }
  for (const name of Object.keys(stages)) {
    if (!MIGRATION_STAGES.includes(name as MigrationStage)) {
      findings.push(`data/run-state.json: unknown stage "${name}"`);
    }
  }
  if (findings.length) return { state: null, findings };

  const batch = parseBatch(record, findings);
  if (!batch) return { state: null, findings };

  if (migrationStageIndex(stage) >= migrationStageIndex('0c_mapping') && batch.id === null) {
    findings.push(
      'data/run-state.json: stage 0c_mapping and later require batch.id',
    );
  }

  const state: MigrationRunState = {
    pipeline: 'cucumber-to-playwright',
    stage: stage as MigrationStage,
    updated_at: record.updated_at as string,
    stages: stages as Record<MigrationStage, MigrationStageStatus>,
    batch,
  };
  const current = migrationStageIndex(state.stage);
  for (let index = 0; index < current; index += 1) {
    const name = MIGRATION_STAGES[index];
    if (state.stages[name] !== 'pass') {
      findings.push(
        `data/run-state.json: cannot be at ${state.stage} while ${name} is ${state.stages[name]}`,
      );
    }
  }
  return { state: findings.length ? null : state, findings };
}

export function runMigrationRunStateGates(): string[] {
  return loadMigrationRunState().findings;
}
