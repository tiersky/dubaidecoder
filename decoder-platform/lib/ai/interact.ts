/**
 * Interact AI Console (IPG) client: OAuth client-credentials token, then a
 * streamed agent call. Ported from competitive-pulse's /api/ai-interpret.
 * Server-only: INTERACT_CLIENT_ID / INTERACT_CLIENT_SECRET never reach the browser.
 */

const AUTH_URL = 'https://interact.interpublic.com/api/token';
const AGENTS_URL = 'https://interact.interpublic.com/api/chat-ai/v1/agents';
const APPLICATION_ID = 'https://interact.interpublic.com/chat-ai/#/app/(chat/new//sidepanel:bots/list)';
const ORGANIZATION_ID = '0BDRDXZ6CX7MS';

export interface Agent {
  name: string;
  id: string;
}

/** Best model first. Gemini sits second because it is a separate provider
 * pool: it stays up when Anthropic is overloaded. */
export const DEFAULT_AGENTS: Agent[] = [
  { name: 'Claude Sonnet', id: '40f9f99f-655a-4527-ba20-2731ede729e0' },
  { name: 'Gemini 2.5 Pro', id: '1a464670-7f39-40a4-875e-e823be904335' },
  { name: 'Claude Haiku', id: '6efa26d2-240a-471b-b21e-dc35909907b6' },
];

/** INTERACT_AGENTS="Name:uuid,Name:uuid" overrides the chain without a deploy of code. */
export function agentChain(env: string | undefined = process.env.INTERACT_AGENTS): Agent[] {
  if (!env?.trim()) return DEFAULT_AGENTS;
  const parsed = env
    .split(',')
    .map((part) => {
      const i = part.lastIndexOf(':');
      return i > 0 ? { name: part.slice(0, i).trim(), id: part.slice(i + 1).trim() } : null;
    })
    .filter((a): a is Agent => Boolean(a?.name && a.id));
  return parsed.length ? parsed : DEFAULT_AGENTS;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function resetTokenCache() {
  cachedToken = null;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) return cachedToken.value;
  const clientId = process.env.INTERACT_CLIENT_ID;
  const clientSecret = process.env.INTERACT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new InteractConfigError('INTERACT_CLIENT_ID / INTERACT_CLIENT_SECRET not set');

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Interact token request failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: now + Math.max(60, json.expires_in - 300) * 1000 };
  return cachedToken.value;
}

export class InteractConfigError extends Error {}

async function callAgent(agentId: string, token: string, message: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${AGENTS_URL}/${agentId}/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-APPLICATION-ID': APPLICATION_ID,
      'X-ORGANIZATION-ID': ORGANIZATION_ID,
      'X-Whitelabel': 'default',
      'X-Request-Id': crypto.randomUUID(),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ chatId: null, message, files: [] }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Interact agent call failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (typeof event?.content === 'string' && !event?.chat) content += event.content;
      } catch {
        // keepalive / non-JSON line
      }
    }
    if (done) break;
  }
  return content.trim();
}

/** Interact sometimes streams an upstream error name as content with HTTP 200. */
export function looksLikeUpstreamError(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (t.length < 80 && /Error\b/.test(t) && !/\s{2,}/.test(t)) return true;
  return /^(?:AnthropicOverloadedError|OverloadedError|RateLimitError|APIError|APIConnectionError|InternalServerError|UpstreamError|TimeoutError|ServiceUnavailable)\b/i.test(t);
}

export interface Generated<T> {
  result: T;
  agent: string;
  attempts: Array<{ agent: string; outcome: 'ok' | 'error' | 'unusable' }>;
}

/**
 * Tries each agent in order and returns the first answer `accept` turns into
 * a value. A failed call, an upstream-error string and an answer that does
 * not parse all fall through to the next agent.
 */
export async function generateWithFallback<T>(
  prompt: string,
  accept: (raw: string) => T | null,
  opts: { agents?: Agent[]; signal?: AbortSignal } = {}
): Promise<Generated<T>> {
  const agents = opts.agents ?? agentChain();
  const token = await getAccessToken();
  const attempts: Generated<T>['attempts'] = [];
  for (const agent of agents) {
    if (opts.signal?.aborted) break;
    try {
      const raw = await callAgent(agent.id, token, prompt, opts.signal);
      const value = looksLikeUpstreamError(raw) ? null : accept(raw);
      if (value !== null) {
        attempts.push({ agent: agent.name, outcome: 'ok' });
        return { result: value, agent: agent.name, attempts };
      }
      attempts.push({ agent: agent.name, outcome: 'unusable' });
      console.warn(`[interact] ${agent.name} returned an unusable answer (${raw.slice(0, 80)})`);
    } catch (err) {
      attempts.push({ agent: agent.name, outcome: 'error' });
      console.warn(`[interact] ${agent.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw new AllAgentsFailedError(attempts);
}

export class AllAgentsFailedError extends Error {
  constructor(public attempts: Array<{ agent: string; outcome: string }>) {
    super(`All Interact agents failed: ${attempts.map((a) => `${a.agent}=${a.outcome}`).join(', ')}`);
  }
}
