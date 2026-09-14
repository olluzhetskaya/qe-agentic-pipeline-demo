/**
 * Shared Langfuse helpers used by Cursor hooks.
 * Cursor passes conversation_id in every hook payload — we use it directly
 * as the trace ID so all hooks in a conversation link to the same trace.
 * No file-based persistence needed.
 */
import fs from 'node:fs';
import { Langfuse } from 'langfuse';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

loadRepoEnv();

function loadRepoEnv(): void {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ── client ────────────────────────────────────────────────────────────────

export function getLangfuse(): Langfuse | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return null;
  try {
    return new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
      flushAt: 1,
      flushInterval: 0,
    });
  } catch { return null; }
}

// ── trace — keyed on conversation_id from the hook payload ────────────────

export function getTrace(lf: Langfuse | null, conversationId: string) {
  if (!lf) return null;
  return lf.trace({
    id: conversationId,
    name: 'qe-pipeline',
    sessionId: process.env.CURSOR_SESSION_ID,
    userId: process.env.LANGFUSE_USER_ID,
    tags: ['cursor', process.env.CURSOR_MODEL ?? 'unknown-model'],
  });
}

export function score(
  lf: Langfuse | null,
  conversationId: string,
  name: string,
  value: 0 | 1,
  comment?: string,
): void {
  if (!lf) return;
  try { lf.score({ traceId: conversationId, name, value, comment }); } catch { /* ignore */ }
}

export async function flush(lf: Langfuse | null): Promise<void> {
  try { await lf?.flushAsync(); } catch { /* ignore */ }
}

export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (c: Buffer) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
  });
}

export function formatNumberedList(items: string[]): string {
  return items.map((item, i) => `  ${i + 1}. ${item}`).join('\n');
}
