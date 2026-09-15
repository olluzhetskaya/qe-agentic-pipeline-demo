/**
 * Cursor hook: beforeSubmitPrompt
 *
 * Stores the current user prompt until afterAgentResponse can create one
 * complete agent-turn trace with meaningful root input and output.
 */
import { readStdin } from './langfuse-client.js';
import { storePrompt } from './prompt-store.js';

interface BeforeSubmitPromptPayload {
  generation_id?: string;
  prompt?: string;
}

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as BeforeSubmitPromptPayload;
storePrompt(payload.generation_id ?? '', payload.prompt ?? '');
process.stdout.write(JSON.stringify({ continue: true }));
