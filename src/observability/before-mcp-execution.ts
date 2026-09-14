/**
 * Cursor hook: beforeMCPExecution
 *
 * Clear reads from identified MCP servers proceed. Writes, unknown tools,
 * and calls with no server identity require approval for that exact call.
 * This protects Xray without relying on its configured server name.
 */
import { flush, getLangfuse, getTrace, readStdin } from './langfuse-client.js';

interface BeforeMcpPayload {
  conversation_id?: string;
  mcp_server_name?: string;
  tool_name?: string;
  tool_input?: string;
}

const CLEAR_READ_PREFIX = /^(get|search|list|find|read|query|inspect|preview|validate|health|whoami)(_|$)/i;
const WRITE_WORD =
  /(^|_)(create|update|delete|import|publish|transition|link|unlink|add|remove|set|assign|move|archive|restore|execute|mutate|upsert)(_|$)/i;

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as BeforeMcpPayload;
const server = payload.mcp_server_name ?? '';
const tool = payload.tool_name ?? '';

const isClearRead = Boolean(server) &&
  CLEAR_READ_PREFIX.test(tool) &&
  !WRITE_WORD.test(tool);

if (isClearRead) {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
} else {
  const lf = getLangfuse();
  const trace = getTrace(lf, payload.conversation_id ?? 'unknown');
  try {
    trace?.event({
      name: 'mcp-approval-required',
      input: { server, tool, tool_input: payload.tool_input ?? null },
      level: 'WARNING',
    });
  } catch {
    /* telemetry must not affect the approval boundary */
  }
  await flush(lf);

  process.stdout.write(JSON.stringify({
    permission: 'ask',
    user_message:
      `Approve this MCP call? Server: ${server || '(missing)'}; tool: ${tool || '(missing)'}. ` +
      'This call is not classified as read-only and can change external state.',
    agent_message:
      'The fail-closed MCP hook requires human approval for this exact call. ' +
      'Show the proposed content before asking for approval.',
  }));
}
