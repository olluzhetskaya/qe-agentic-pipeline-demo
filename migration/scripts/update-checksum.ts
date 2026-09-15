import fs from 'node:fs';
import { computeHarnessDigest, HARNESS_CHECKSUM_PATH } from '../src/validation/harness-checksum.js';

const record = {
  algorithm: 'sha256',
  tracks: ['src/validation', 'src/observability'],
  digest: computeHarnessDigest(),
};

fs.writeFileSync(HARNESS_CHECKSUM_PATH, `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${record.digest}\n`);
