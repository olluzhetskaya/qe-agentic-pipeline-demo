/**
 * Cursor hook: afterAgentResponse
 *
 * Emits an `agent-response` generation to Langfuse with usageDetails and
 * costDetails so native Cost analytics work (Langfuse → Analytics → Costs).
 * Token counts come from the hook payload when present; otherwise completion
 * is estimated from response text (chars / 4).
 */
import {
  getLangfuse, getTrace, flush, readStdin,
} from './langfuse-client.js';
import { getConversationSpend, submitRealSpendScore } from './cursor-spend.js';

const CHARS_PER_TOKEN = 4;
const OUTPUT_PREVIEW = 4_000;

/** USD per 1M tokens. Approximate public list prices — Cursor slugs won't match Langfuse's catalog. */
interface Rates {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const SONNET: Rates = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };
const OPUS: Rates = { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 };
const HAIKU: Rates = { input: 1, output: 5, cacheRead: 0.10, cacheWrite: 1.25 };
const GROK: Rates = { input: 0.20, output: 1.50, cacheRead: 0.02, cacheWrite: 0.25 };

interface Payload {
  conversation_id?: string;
  generation_id?: string;
  model?: string;
  model_id?: string;
  text?: string;
  response?: string;
  content?: string;
  output?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function responseText(p: Payload): string {
  return p.text ?? p.response ?? p.content ?? p.output ?? '';
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function ratesFor(model: string): Rates {
  const m = model.toLowerCase();
  if (m.includes('opus')) return OPUS;
  if (m.includes('haiku')) return HAIKU;
  if (m.includes('grok') || m.includes('composer')) return GROK;
  return SONNET;
}

function usd(tokens: number, perMillion: number): number {
  return (tokens / 1_000_000) * perMillion;
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

const raw = await readStdin();
const payload = JSON.parse(raw || '{}') as Payload;
const convId = payload.conversation_id ?? 'unknown';
const model = payload.model ?? payload.model_id ?? process.env.CURSOR_MODEL ?? 'unknown';
const text = responseText(payload);

const cacheRead = num(payload.cache_read_tokens);
const cacheWrite = num(payload.cache_write_tokens);
const rawInput = num(payload.input_tokens);
const rawOutput = num(payload.output_tokens);

// Cursor's input_tokens includes cache read/write. Split so Langfuse charts stay non-overlapping.
const prompt = rawInput > 0
  ? Math.max(0, rawInput - cacheRead - cacheWrite)
  : 0;
const completion = rawOutput > 0 ? rawOutput : estimateTokens(text);
const total = prompt + completion + cacheRead + cacheWrite;

const rates = ratesFor(model);
const inputCost = usd(prompt, rates.input);
const outputCost = usd(completion, rates.output);
const cacheReadCost = usd(cacheRead, rates.cacheRead);
const cacheWriteCost = usd(cacheWrite, rates.cacheWrite);
const totalCost = roundUsd(inputCost + outputCost + cacheReadCost + cacheWriteCost);

const lf = getLangfuse();
const trace = getTrace(lf, convId);
const start = new Date();

trace?.generation({
  ...(payload.generation_id ? { id: payload.generation_id } : {}),
  name: 'agent-response',
  model,
  startTime: start,
  usageDetails: {
    prompt,
    completion,
    cache_read: cacheRead,
    cache_write: cacheWrite,
    total,
  },
  costDetails: {
    input: roundUsd(inputCost),
    output: roundUsd(outputCost),
    cache_read: roundUsd(cacheReadCost),
    cache_write: roundUsd(cacheWriteCost),
    total: totalCost,
  },
}).end({
  output: text.length > OUTPUT_PREVIEW ? `${text.slice(0, OUTPUT_PREVIEW)}…` : text,
  metadata: {
    estimated_completion: rawOutput === 0,
    rates_usd_per_million: rates,
  },
});

await flush(lf);

const spend = convId === 'unknown' ? null : await getConversationSpend(convId);
if (spend !== null) {
  await submitRealSpendScore(convId, spend);
}

process.stdout.write(JSON.stringify({}));
