/** Optional local Xray catalogue. Fetch once; diff on disk; do not probe per case. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './shared.js';
import { loadRunState, type RunState } from './run-state.js';

export const XRAY_INDEX_REL = 'data/xray-index.json';
export const XRAY_INDEX_PATH = path.join(ROOT, XRAY_INDEX_REL);
const DESIGN_PATH = path.join(ROOT, 'data/test-design.json');

const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

export interface XrayIndexEntry {
  key: string;
  summary: string;
  requirement_id: string;
}

export interface XrayIndex {
  project_key: string;
  requirement_id: string;
  fetched_at: string;
  tools_resolved: {
    create: string;
    search: string;
    update: string;
  };
  existing: XrayIndexEntry[];
}

export interface LoadedXrayIndex {
  present: boolean;
  index: XrayIndex | null;
  findings: string[];
}

function requiredToolName(value: unknown, field: string, findings: string[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    findings.push(`${XRAY_INDEX_REL}: tools_resolved.${field} must be a non-empty tool name`);
    return '';
  }
  return value.trim();
}

function parseEntry(raw: unknown, at: string, requirementId: string, findings: string[]): XrayIndexEntry | null {
  if (!raw || typeof raw !== 'object') {
    findings.push(`${at}: must be an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.key !== 'string' || !record.key.trim()) {
    findings.push(`${at}: key must be a non-empty issue key`);
  }
  if (typeof record.summary !== 'string' || !record.summary.trim()) {
    findings.push(`${at}: summary must be a non-empty string`);
  }
  if (typeof record.requirement_id !== 'string' || !record.requirement_id.trim()) {
    findings.push(`${at}: requirement_id is required`);
  } else if (requirementId && record.requirement_id !== requirementId) {
    findings.push(`${at}: requirement_id must match the catalogue requirement_id`);
  }
  if (findings.some(finding => finding.startsWith(`${at}:`))) return null;
  return {
    key: record.key as string,
    summary: record.summary as string,
    requirement_id: record.requirement_id as string,
  };
}

export function loadXrayIndex(): LoadedXrayIndex {
  if (!fs.existsSync(XRAY_INDEX_PATH)) {
    return { present: false, index: null, findings: [] };
  }
  const findings: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(XRAY_INDEX_PATH, 'utf8')) as unknown;
  } catch {
    return {
      present: true,
      index: null,
      findings: [`${XRAY_INDEX_REL}: missing or invalid JSON`],
    };
  }
  if (!raw || typeof raw !== 'object') {
    return { present: true, index: null, findings: [`${XRAY_INDEX_REL}: must be an object`] };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.project_key !== 'string' || !record.project_key.trim()) {
    findings.push(`${XRAY_INDEX_REL}: project_key is required`);
  }
  if (typeof record.requirement_id !== 'string' || !record.requirement_id.trim()) {
    findings.push(`${XRAY_INDEX_REL}: requirement_id is required`);
  }
  if (typeof record.fetched_at !== 'string' || !ISO_PREFIX.test(record.fetched_at)) {
    findings.push(`${XRAY_INDEX_REL}: fetched_at must be an ISO-8601 timestamp`);
  } else if (Number.isNaN(Date.parse(record.fetched_at))) {
    findings.push(`${XRAY_INDEX_REL}: fetched_at must be a parseable timestamp`);
  }
  if (!record.tools_resolved || typeof record.tools_resolved !== 'object') {
    findings.push(`${XRAY_INDEX_REL}: tools_resolved is required`);
  }
  const tools = (record.tools_resolved ?? {}) as Record<string, unknown>;
  const create = requiredToolName(tools.create, 'create', findings);
  const search = requiredToolName(tools.search, 'search', findings);
  const update = requiredToolName(tools.update, 'update', findings);
  if (!Array.isArray(record.existing)) {
    findings.push(`${XRAY_INDEX_REL}: existing must be an array`);
  }
  const requirementId = typeof record.requirement_id === 'string' ? record.requirement_id : '';
  const existing: XrayIndexEntry[] = [];
  const seenKeys = new Set<string>();
  if (Array.isArray(record.existing)) {
    record.existing.forEach((entry, index) => {
      const parsed = parseEntry(entry, `${XRAY_INDEX_REL}: existing[${index}]`, requirementId, findings);
      if (!parsed) return;
      if (seenKeys.has(parsed.key)) {
        findings.push(`${XRAY_INDEX_REL}: duplicate catalogue key ${parsed.key}`);
        return;
      }
      seenKeys.add(parsed.key);
      existing.push(parsed);
    });
  }
  if (findings.length) return { present: true, index: null, findings };
  return {
    present: true,
    index: {
      project_key: record.project_key as string,
      requirement_id: record.requirement_id as string,
      fetched_at: record.fetched_at as string,
      tools_resolved: { create, search, update },
      existing,
    },
    findings: [],
  };
}

export function catalogueMatchesRequirement(
  index: XrayIndex,
  requirementId: string,
  projectKey: string,
): boolean {
  return index.requirement_id === requirementId && index.project_key === projectKey;
}

export function validateXrayIndexFreshness(
  index: XrayIndex,
  state: RunState | null,
  findings: string[],
): void {
  const fetched = Date.parse(index.fetched_at);
  if (state && Date.parse(state.updated_at) > fetched) {
    findings.push(
      `${XRAY_INDEX_REL}: fetched_at is older than data/run-state.json; refetch the catalogue`,
    );
  }
  try {
    const designMtime = fs.statSync(DESIGN_PATH).mtimeMs;
    if (designMtime > fetched) {
      const design = JSON.parse(fs.readFileSync(DESIGN_PATH, 'utf8')) as {
        test_cases?: Array<{ title?: unknown }>;
      };
      const titles = (design.test_cases ?? [])
        .map(testCase => (typeof testCase.title === 'string' ? testCase.title : ''))
        .filter(Boolean);
      const missing = titles.filter(
        title => !index.existing.some(entry => entry.summary === title),
      );
      if (missing.length > 0) {
        findings.push(
          `${XRAY_INDEX_REL}: catalogue is older than data/test-design.json and does not list ${missing.join(', ')}; refetch`,
        );
      }
    }
  } catch {
    /* design unreadable — design-gates already reports that */
  }
}

export function alignManualCasesWithCatalogue(
  index: XrayIndex,
  cases: Array<{ id?: unknown; title?: unknown; test_type?: unknown; xray_key?: unknown }>,
  findings: string[],
): void {
  for (const [offset, testCase] of cases.entries()) {
    const label = `data/test-design.json: test_cases[${offset}]`;
    if (testCase.test_type !== 'Manual') continue;
    const title = typeof testCase.title === 'string' ? testCase.title : '';
    const hit = title ? index.existing.find(entry => entry.summary === title) : undefined;
    const key = testCase.xray_key;
    if (hit) {
      if (key !== hit.key) {
        findings.push(
          `${label}: xray_key must be ${hit.key} (catalogue hit on summary)`,
        );
      }
    } else if (typeof key === 'string' && key.trim()) {
      const byKey = index.existing.find(entry => entry.key === key);
      if (!byKey) {
        findings.push(`${label}: xray_key ${key} is not in ${XRAY_INDEX_REL}`);
      }
    }
  }
}

export function runXrayIndexGates(): string[] {
  const loaded = loadXrayIndex();
  if (!loaded.present) return [];
  const findings = [...loaded.findings];
  if (!loaded.index) return findings;
  const { state } = loadRunState();
  validateXrayIndexFreshness(loaded.index, state, findings);
  return findings;
}
