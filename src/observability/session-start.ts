/**
 * Cursor hook: sessionStart
 *
 * Records that the local MCP approval gate is wired. Cloud agents do not
 * run this hook. xray-publisher refuses to proceed without the file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readStdin, REPO_ROOT } from './langfuse-client.js';

const STATUS_PATH = path.join(REPO_ROOT, '.cursor/gate-status.json');

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as {
  conversation_id?: string;
  is_background_agent?: boolean;
};

const status = {
  mcp_gate: true,
  environment: 'local',
  conversation_id: payload.conversation_id ?? null,
  written_at: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
fs.writeFileSync(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
process.stdout.write(JSON.stringify({}));
