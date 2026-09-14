/** Resumable pipeline pointer. Stage order lives on disk, not in chat. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './shared.js';

export const RUN_STATE_PATH = path.join(ROOT, 'data/run-state.json');

export const PIPELINE_STAGES = [
  '0a_requirements',
  '0b_objectives',
  '0c_design',
  '0d_design_review',
  '0e_xray_publish',
  '1a_generation',
  '1b_code_review',
  '1c_pr_draft',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];
export type StageStatus = 'pending' | 'pass' | 'fail' | 'waiting';

export interface RunState {
  requirement_id: string;
  stage: PipelineStage;
  updated_at: string;
  stages: Record<PipelineStage, StageStatus>;
}

const STATUSES = new Set<StageStatus>(['pending', 'pass', 'fail', 'waiting']);

export function stageIndex(stage: string): number {
  return (PIPELINE_STAGES as readonly string[]).indexOf(stage);
}

export function generationUnlocked(state: RunState): boolean {
  return stageIndex(state.stage) >= stageIndex('1a_generation');
}

export function loadRunState(): { state: RunState | null; findings: string[] } {
  const findings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(RUN_STATE_PATH, 'utf8')) as unknown;
  } catch {
    return { state: null, findings: ['data/run-state.json: missing or invalid JSON'] };
  }
  if (!raw || typeof raw !== 'object') {
    return { state: null, findings: ['data/run-state.json: must be an object'] };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.requirement_id !== 'string' || !record.requirement_id.trim()) {
    findings.push('data/run-state.json: requirement_id is required');
  }
  if (typeof record.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.updated_at)) {
    findings.push('data/run-state.json: updated_at must be an ISO-8601 timestamp');
  }
  const stage = String(record.stage ?? '');
  if (!PIPELINE_STAGES.includes(stage as PipelineStage)) {
    findings.push(
      `data/run-state.json: stage must be one of ${PIPELINE_STAGES.join(', ')}`,
    );
  }
  if (!record.stages || typeof record.stages !== 'object') {
    findings.push('data/run-state.json: stages must be an object');
    return { state: null, findings };
  }
  const stages = record.stages as Record<string, unknown>;
  for (const name of PIPELINE_STAGES) {
    const status = stages[name];
    if (!STATUSES.has(status as StageStatus)) {
      findings.push(`data/run-state.json: stages.${name} must be pending, pass, fail, or waiting`);
    }
  }
  for (const name of Object.keys(stages)) {
    if (!PIPELINE_STAGES.includes(name as PipelineStage)) {
      findings.push(`data/run-state.json: unknown stage "${name}"`);
    }
  }
  if (findings.length) return { state: null, findings };

  const state: RunState = {
    requirement_id: record.requirement_id as string,
    stage: stage as PipelineStage,
    updated_at: record.updated_at as string,
    stages: stages as Record<PipelineStage, StageStatus>,
  };
  const current = stageIndex(state.stage);
  for (let index = 0; index < current; index += 1) {
    const name = PIPELINE_STAGES[index];
    if (state.stages[name] !== 'pass') {
      findings.push(
        `data/run-state.json: cannot be at ${state.stage} while ${name} is ${state.stages[name]}`,
      );
    }
  }
  return { state: findings.length ? null : state, findings };
}

export function runRunStateGates(): string[] {
  const { state, findings } = loadRunState();
  if (!state) return findings;
  try {
    const requirement = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/requirement.json'), 'utf8'),
    ) as { id?: unknown; analysis_decision?: { status?: unknown } };
    if (requirement.id !== state.requirement_id) {
      findings.push('data/run-state.json: requirement_id must match data/requirement.json');
    }
    const decision = String(requirement.analysis_decision?.status ?? '');
    if (decision === 'WAITING') {
      if (state.stages['0a_requirements'] !== 'waiting') {
        findings.push('data/run-state.json: 0a_requirements must be waiting while analysis_decision is WAITING');
      }
      if (state.stage !== '0a_requirements') {
        findings.push('data/run-state.json: cannot leave 0a while analysis_decision is WAITING');
      }
    } else if (stageIndex(state.stage) > 0 && decision !== 'AUTO_PROCEED') {
      findings.push('data/run-state.json: stages after 0a require analysis_decision.status AUTO_PROCEED');
    }
  } catch {
    findings.push('data/run-state.json: cannot verify requirement_id — data/requirement.json is unreadable');
  }
  return findings;
}
