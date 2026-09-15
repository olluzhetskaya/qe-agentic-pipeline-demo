/** Shared Langfuse v5 / OpenTelemetry helpers used by Cursor hooks. */
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
  propagateAttributes,
  startObservation,
} from '@langfuse/tracing';
import { NodeSDK } from '@opentelemetry/sdk-node';
import fs from 'node:fs';
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

export type LangfuseProfile = 'qe' | 'migration';

export interface LangfuseConfig {
  profile: LangfuseProfile;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  environment: string;
}

interface Endable {
  end(attributes?: Record<string, unknown>): void;
  readonly traceId: string;
}

interface TraceAdapter {
  span(params: Record<string, unknown> & { name: string }): Endable;
  evaluator(params: Record<string, unknown> & { name: string }): Endable;
  tool(params: Record<string, unknown> & { name: string }): Endable;
  agent(params: Record<string, unknown> & { name: string }): Endable;
  generation(params: Record<string, unknown> & { name: string }): Endable;
  event(params: Record<string, unknown> & { name: string }): void;
}

export interface LangfuseTelemetry {
  config: LangfuseConfig;
  processor: LangfuseSpanProcessor;
  sdk: NodeSDK;
  conversationId: string;
  lastTraceId: string | null;
  pendingScores: Array<() => Promise<unknown>>;
}

export interface AgentTurn {
  generationId: string | null;
  prompt: string | null;
  response: string;
  model: string;
  usageDetails: Record<string, number>;
  costDetails: Record<string, number>;
  metadata: Record<string, unknown>;
}

const DEFAULT_BASE_URL = 'https://cloud.langfuse.com';
const SENSITIVE_KEY = /(authorization|cookie|credential|password|secret|token|api.?key)/i;
const LANGFUSE_KEY = /\b(?:pk|sk)-lf-[A-Za-z0-9_-]+\b/g;
const BEARER_TOKEN = /\bBearer\s+\S+/gi;

function selectedProfile(profile?: LangfuseProfile): LangfuseProfile {
  if (profile) return profile;
  return process.env.LANGFUSE_PROFILE === 'qe' ? 'qe' : 'migration';
}

export function getLangfuseConfig(profile?: LangfuseProfile): LangfuseConfig | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY ?? '';
  const secretKey = process.env.LANGFUSE_SECRET_KEY ?? '';
  if (!publicKey || !secretKey) return null;
  return {
    profile: selectedProfile(profile),
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? DEFAULT_BASE_URL,
    environment: process.env.LANGFUSE_TRACING_ENVIRONMENT ?? 'development',
  };
}

function redact(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    return value
      .replace(LANGFUSE_KEY, '[REDACTED_LANGFUSE_KEY]')
      .replace(BEARER_TOKEN, 'Bearer [REDACTED]');
  }
  if (Array.isArray(value)) return value.map(item => redact(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [entryKey, redact(entry, entryKey)]),
    );
  }
  return value;
}

export function getLangfuse(
  conversationId = 'unknown',
  profile?: LangfuseProfile,
): LangfuseTelemetry | null {
  const config = getLangfuseConfig(profile);
  if (!config) return null;
  try {
    const processor = new LangfuseSpanProcessor({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      environment: config.environment,
      exportMode: 'immediate',
      mask: ({ data }) => redact(data),
    });
    const sdk = new NodeSDK({ spanProcessors: [processor] });
    sdk.start();
    return {
      config,
      processor,
      sdk,
      conversationId,
      lastTraceId: null,
      pendingScores: [],
    };
  } catch {
    return null;
  }
}

function observationParams(params: Record<string, unknown> & { name: string }): {
  name: string;
  attributes: Record<string, unknown>;
  startTime?: Date;
} {
  const { name, startTime, ...attributes } = params;
  return {
    name,
    attributes,
    ...(startTime instanceof Date ? { startTime } : {}),
  };
}

function withAttributes<T>(
  telemetry: LangfuseTelemetry,
  traceName: string,
  create: () => T,
): T {
  let result: T | undefined;
  propagateAttributes(
    {
      traceName: `${telemetry.config.profile}-${traceName}`,
      ...(telemetry.conversationId === 'unknown'
        ? {}
        : { sessionId: telemetry.conversationId }),
      ...(process.env.LANGFUSE_USER_ID
        ? { userId: process.env.LANGFUSE_USER_ID }
        : {}),
      tags: [
        'cursor',
        `pipeline:${telemetry.config.profile}`,
      ],
      metadata: {
        workspace: path.basename(REPO_ROOT),
        profile: telemetry.config.profile,
      },
    },
    () => {
      result = create();
    },
  );
  return result as T;
}

function endable<T extends {
  traceId: string;
  update(attributes: never): T;
  end(): void;
}>(telemetry: LangfuseTelemetry, observation: T): Endable {
  telemetry.lastTraceId = observation.traceId;
  return {
    traceId: observation.traceId,
    end(attributes?: Record<string, unknown>): void {
      if (attributes) observation.update(attributes as never);
      observation.end();
    },
  };
}

export function getTrace(
  telemetry: LangfuseTelemetry | null,
  conversationId: string,
): TraceAdapter | null {
  if (!telemetry) return null;
  if (telemetry.conversationId !== conversationId) return null;
  return {
    span(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'span', startTime }));
      return endable(telemetry, observation);
    },
    evaluator(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'evaluator', startTime }));
      return endable(telemetry, observation);
    },
    tool(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'tool', startTime }));
      return endable(telemetry, observation);
    },
    agent(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'agent', startTime }));
      return endable(telemetry, observation);
    },
    generation(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'generation', startTime }));
      return endable(telemetry, observation);
    },
    event(params) {
      const { name, attributes, startTime } = observationParams(params);
      const observation = withAttributes(telemetry, name, () =>
        startObservation(name, attributes, { asType: 'event', startTime }));
      telemetry.lastTraceId = observation.traceId;
    },
  };
}

export function recordAgentTurn(
  telemetry: LangfuseTelemetry | null,
  turn: AgentTurn,
): string | null {
  if (!telemetry) return null;
  const traceId = withAttributes(telemetry, 'agent-turn', () => {
    const messages = turn.prompt === null
      ? null
      : [{ role: 'user', content: turn.prompt }];
    const agent = startObservation(
      'run-cursor-agent',
      {
        input: messages,
        metadata: {
          cursor_generation_id: turn.generationId,
          prompt_available: turn.prompt !== null,
        },
      },
      { asType: 'agent' },
    );
    const generation = agent.startObservation(
      'generate-agent-response',
      {
        model: turn.model,
        input: messages,
        usageDetails: turn.usageDetails,
        costDetails: turn.costDetails,
        metadata: turn.metadata,
      },
      { asType: 'generation' },
    );
    generation.update({ output: turn.response }).end();
    agent.update({ output: turn.response }).end();
    return agent.traceId;
  });
  telemetry.lastTraceId = traceId;
  return traceId;
}

export function score(
  telemetry: LangfuseTelemetry | null,
  _conversationId: string,
  name: string,
  value: 0 | 1,
  comment?: string,
): void {
  if (!telemetry?.lastTraceId) return;
  const auth = Buffer.from(
    `${telemetry.config.publicKey}:${telemetry.config.secretKey}`,
  ).toString('base64');
  const traceId = telemetry.lastTraceId;
  telemetry.pendingScores.push(() =>
    fetch(`${telemetry.config.baseUrl}/api/public/scores`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traceId,
        name,
        value,
        dataType: 'NUMERIC',
        ...(comment ? { comment } : {}),
      }),
    }).catch(() => undefined),
  );
}

export async function flush(telemetry: LangfuseTelemetry | null): Promise<void> {
  try {
    await telemetry?.processor.forceFlush();
    await Promise.all(telemetry?.pendingScores.map(request => request()) ?? []);
    await telemetry?.sdk.shutdown();
  } catch {
    /* observability must not fail-close */
  }
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
