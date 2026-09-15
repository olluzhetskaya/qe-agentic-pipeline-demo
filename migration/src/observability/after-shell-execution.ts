/** Cursor hook: afterShellExecution — records completed shell tool calls. */
import { flush, getLangfuse, getTrace, readStdin } from './langfuse-client.js';

const OUTPUT_LIMIT = 4_000;

interface AfterShellPayload {
  conversation_id?: string;
  command?: string;
  output?: string;
  duration?: number;
  sandbox?: boolean;
}

function preview(value: string): string {
  return value.length > OUTPUT_LIMIT ? `${value.slice(0, OUTPUT_LIMIT)}…` : value;
}

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as AfterShellPayload;
const conversationId = payload.conversation_id ?? 'unknown';
const telemetry = getLangfuse(conversationId);
const trace = getTrace(telemetry, conversationId);
trace?.tool({
  name: 'execute-shell-command',
  input: { command: payload.command ?? '' },
  metadata: {
    duration_ms: payload.duration ?? null,
    sandbox: payload.sandbox ?? null,
    output_truncated: (payload.output?.length ?? 0) > OUTPUT_LIMIT,
  },
}).end({
  output: preview(payload.output ?? ''),
});
await flush(telemetry);
process.stdout.write(JSON.stringify({}));
