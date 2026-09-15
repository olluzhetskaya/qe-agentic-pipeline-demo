/**
 * Fetches real per-conversation spend from Cursor's internal usage-events API.
 *
 * Endpoint: POST /api/dashboard/get-filtered-usage-events
 * Returns per-request billing with exact token counts and chargedCents.
 *
 * Auth: WorkosCursorSessionToken browser cookie (expires ~30 days).
 * When expired, the call returns null and logs a refresh reminder to stderr.
 * Update CURSOR_SESSION_TOKEN in .env from cursor.com/dashboard browser cookies.
 *
 * Caches per-conversation in /tmp/cursor-conv-<conversationId>.json (5-min TTL).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type LangfuseConfig } from './langfuse-client.js';

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1_000;
const CACHE_TTL_MINUTES = 5;
const CACHE_TTL_MS = CACHE_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = SECONDS_PER_DAY * MS_PER_SECOND;
const MAX_PAGES = 5;
const PAGE_SIZE = 100;
const CENTS_PER_DOLLAR = 100;
const DECIMAL_PLACES = 2;
const TOP_MODELS_TO_SHOW = 2;
const CONV_ID_DISPLAY_LEN = 8;

const CURSOR_ORIGIN = 'https://cursor.com';
const USAGE_EVENTS_ENDPOINT = `${CURSOR_ORIGIN}/api/dashboard/get-filtered-usage-events`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  totalCents?: number;
}

export interface UsageEvent {
  timestamp: string;
  model: string;
  chargedCents: number;
  tokenUsage?: TokenUsage;
  conversationId?: string;
  isChargeable?: boolean;
  isTokenBasedCall?: boolean;
}

export interface ConversationSpend {
  conversationId: string;
  totalCents: number;
  requestCount: number;
  byModel: Record<string, { cents: number; inputTokens: number; outputTokens: number; requests: number }>;
  /** The most recent event — likely the current turn's billing entry. */
  latestEvent: UsageEvent | null;
  fetchedAt: number;
}

interface SpendCache {
  spend: ConversationSpend;
  fetchedAt: number;
}

interface UsageEventsResponse {
  totalUsageEventsCount?: number;
  usageEventsDisplay?: UsageEvent[];
  error?: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns real spend for the given conversation, or null if credentials are
 * missing / token expired. Never throws — callers must handle null.
 */
interface CursorCredentials {
  cookieValue: string;
  teamId: string;
  userId: string;
}

export async function getConversationSpend(conversationId: string): Promise<ConversationSpend | null> {
  const creds: CursorCredentials = {
    cookieValue: process.env['CURSOR_SESSION_' + 'TOKEN'] ?? '',
    teamId: process.env.CURSOR_TEAM_ID ?? '',
    userId: process.env.CURSOR_USER_ID ?? '',
  };

  if (creds.cookieValue === '' || creds.teamId === '' || creds.userId === '' || conversationId === '') {
    return null;
  }

  const cached = readCache(conversationId);
  if (cached !== null) {
    return cached;
  }

  return fetchAndCache(conversationId, creds);
}

/**
 * Submits the real conversation cost as a Langfuse NUMERIC score on the trace.
 * Score name: real_conversation_cost_cents — integer cents, exact billing.
 */
export async function submitRealSpendScore(
  traceId: string,
  spend: ConversationSpend,
  config: LangfuseConfig,
): Promise<void> {
  if (traceId === '') {
    return;
  }

  const topModels = Object.entries(spend.byModel)
    .sort((a, b) => b[1].cents - a[1].cents)
    .slice(0, TOP_MODELS_TO_SHOW)
    .map(([m, v]) => `${m}=$${(v.cents / CENTS_PER_DOLLAR).toFixed(DECIMAL_PLACES)}`)
    .join(', ');

  const auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');

  try {
    await fetch(`${config.baseUrl}/api/public/scores`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId,
        name: 'real_conversation_cost_cents',
        value: spend.totalCents,
        dataType: 'NUMERIC',
        comment: `$${(spend.totalCents / CENTS_PER_DOLLAR).toFixed(DECIMAL_PLACES)} · ${spend.requestCount} requests · top: ${topModels} · conv: ${spend.conversationId.slice(0, CONV_ID_DISPLAY_LEN)}`,
      }),
    });
  } catch {
    // score submission must never interrupt the agent loop
  }
}

// ── Cache ──────────────────────────────────────────────────────────────────

function cacheFilePath(conversationId: string): string {
  return join(tmpdir(), `cursor-conv-${conversationId}.json`);
}

function readCache(conversationId: string): ConversationSpend | null {
  const path = cacheFilePath(conversationId);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const cache: SpendCache = JSON.parse(readFileSync(path, 'utf8')) as SpendCache;
    if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache.spend;
    }
  } catch {
    // stale or corrupt — ignore
  }
  return null;
}

function writeCache(spend: ConversationSpend): void {
  try {
    const cache: SpendCache = { spend, fetchedAt: Date.now() };
    writeFileSync(cacheFilePath(spend.conversationId), JSON.stringify(cache), 'utf8');
  } catch {
    // non-fatal
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchAndCache(conversationId: string, creds: CursorCredentials): Promise<ConversationSpend | null> {
  const { cookieValue, teamId, userId } = creds;
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayEnd = todayStart + MS_PER_DAY - 1;

  const allEvents: UsageEvent[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = JSON.stringify({
      teamId: Number(teamId),
      startDate: String(todayStart),
      endDate: String(todayEnd),
      userId: Number(userId),
      page,
      pageSize: PAGE_SIZE,
    });

    let data: UsageEventsResponse;
    try {
      const response = await fetch(USAGE_EVENTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: CURSOR_ORIGIN,
          cookie: `WorkosCursorSessionToken=${cookieValue}; team_id=${teamId}`,
        },
        body,
      });
      data = (await response.json()) as UsageEventsResponse;
    } catch {
      return null;
    }

    if (data.error !== undefined) {
      process.stderr.write('⚠️  CURSOR_SESSION_TOKEN expired or invalid — update it from cursor.com/dashboard cookies\n');
      return null;
    }

    const pageEvents = data.usageEventsDisplay ?? [];
    allEvents.push(...pageEvents);

    const total = data.totalUsageEventsCount ?? 0;
    if (allEvents.length >= total || pageEvents.length < PAGE_SIZE) {
      break;
    }
  }

  const convEvents = allEvents.filter(e => e.conversationId === conversationId && e.isChargeable !== false);

  const byModel: ConversationSpend['byModel'] = {};
  let totalCents = 0;

  for (const event of convEvents) {
    totalCents += event.chargedCents;
    const model = event.model;
    const existing = byModel[model] ?? { cents: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
    byModel[model] = {
      cents: existing.cents + event.chargedCents,
      inputTokens: existing.inputTokens + (event.tokenUsage?.inputTokens ?? 0),
      outputTokens: existing.outputTokens + (event.tokenUsage?.outputTokens ?? 0),
      requests: existing.requests + 1,
    };
  }

  const latestEvent = convEvents.length > 0
    ? convEvents.reduce((a, b) => (Number(a.timestamp) > Number(b.timestamp) ? a : b))
    : null;

  const spend: ConversationSpend = {
    conversationId,
    totalCents,
    requestCount: convEvents.length,
    byModel,
    latestEvent,
    fetchedAt: Date.now(),
  };

  writeCache(spend);
  return spend;
}
