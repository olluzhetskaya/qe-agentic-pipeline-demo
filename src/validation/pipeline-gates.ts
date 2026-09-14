/** Small entry point that composes independent deterministic gate directions. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConfigGates } from './config-gates.js';
import { runDataGates } from './data-gates.js';
import { runDesignGates } from './design-gates.js';
import { runQualityGates } from './quality-gates.js';
import { runVerdictGates } from './verdict-gates.js';
import { type GateResult } from './shared.js';

export type GateDirection = 'all' | 'config' | 'design' | 'data' | 'quality' | 'verdicts';

const DIRECTIONS: Record<Exclude<GateDirection, 'all'>, () => string[]> = {
  config: runConfigGates,
  design: runDesignGates,
  data: runDataGates,
  quality: runQualityGates,
  verdicts: runVerdictGates,
};

export function runPipelineGates(direction: GateDirection = 'all'): GateResult {
  const runners = direction === 'all' ? Object.values(DIRECTIONS) : [DIRECTIONS[direction]];
  const findings = runners.flatMap(run => run());
  return { pass: findings.length === 0, findings };
}

const invokedAsScript = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  const requested = process.argv[2] ?? 'all';
  if (!(requested === 'all' || requested in DIRECTIONS)) {
    process.stderr.write(`unknown gate direction "${requested}"; use all, config, design, data, quality, or verdicts\n`);
    process.exit(2);
  }
  const direction = requested as GateDirection;
  const result = runPipelineGates(direction);
  if (result.pass) {
    process.stdout.write(`pipeline gates (${direction}): PASS\n`);
  } else {
    process.stderr.write([
      `pipeline gates: FAIL (${result.findings.length})`,
      ...result.findings.map((finding, index) => `  ${index + 1}. ${finding}`),
      '',
    ].join('\n'));
    process.exitCode = 1;
  }
}
