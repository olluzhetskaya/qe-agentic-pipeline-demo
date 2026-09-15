/**
 * Digest of the code the hooks execute. A validator or hook edit that is
 * not accompanied by an updated `data/harness-checksum.json` is FAIL — so
 * weakening a gate is a visible artifact change even if afterFileEdit is
 * what got modified (Husky / `npm run validate` still compare).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { filesUnder, rel, ROOT } from './shared.js';

export const HARNESS_CHECKSUM_PATH = path.join(ROOT, 'data/harness-checksum.json');
export const HARNESS_TRACKED_DIRS = ['src/validation', 'src/observability'] as const;

interface ChecksumFile {
  algorithm?: unknown;
  tracks?: unknown;
  digest?: unknown;
}

export function harnessSourceFiles(): string[] {
  return HARNESS_TRACKED_DIRS
    .flatMap(dir => filesUnder(path.join(ROOT, dir), '.ts'))
    .sort((a, b) => rel(a).localeCompare(rel(b)));
}

export function computeHarnessDigest(): string {
  const hash = crypto.createHash('sha256');
  for (const file of harnessSourceFiles()) {
    hash.update(rel(file).split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function runHarnessChecksumGate(): string[] {
  const findings: string[] = [];
  const expected = computeHarnessDigest();
  let recorded: ChecksumFile;
  try {
    recorded = JSON.parse(fs.readFileSync(HARNESS_CHECKSUM_PATH, 'utf8')) as ChecksumFile;
  } catch {
    findings.push('data/harness-checksum.json: missing or invalid JSON');
    return findings;
  }
  if (recorded.algorithm !== 'sha256') {
    findings.push('data/harness-checksum.json: algorithm must be "sha256"');
  }
  const tracks = Array.isArray(recorded.tracks) ? recorded.tracks.map(String) : [];
  if (tracks.length !== HARNESS_TRACKED_DIRS.length ||
      HARNESS_TRACKED_DIRS.some((dir, index) => tracks[index] !== dir)) {
    findings.push(
      `data/harness-checksum.json: tracks must be ${JSON.stringify([...HARNESS_TRACKED_DIRS])}`,
    );
  }
  if (recorded.digest !== expected) {
    findings.push(
      'data/harness-checksum.json: digest is stale — src/validation or src/observability changed; ' +
      `update digest to ${expected}`,
    );
  }
  return findings;
}
