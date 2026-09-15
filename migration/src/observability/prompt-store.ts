/** Short-lived local handoff from beforeSubmitPrompt to afterAgentResponse. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

interface StoredPrompt {
  generationId: string;
  prompt: string;
  storedAt: string;
}

function promptPath(generationId: string): string {
  const digest = crypto.createHash('sha256').update(generationId).digest('hex');
  return path.join(tmpdir(), `migration-pipeline-prompt-${digest}.json`);
}

export function storePrompt(generationId: string, prompt: string): void {
  if (!generationId || !prompt) return;
  const value: StoredPrompt = {
    generationId,
    prompt,
    storedAt: new Date().toISOString(),
  };
  fs.writeFileSync(promptPath(generationId), JSON.stringify(value), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function takePrompt(generationId: string): string | null {
  if (!generationId) return null;
  const file = promptPath(generationId);
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredPrompt;
    return value.generationId === generationId ? value.prompt : null;
  } catch {
    return null;
  } finally {
    try {
      fs.unlinkSync(file);
    } catch {
      /* Missing files are normal when a prompt hook did not run. */
    }
  }
}
