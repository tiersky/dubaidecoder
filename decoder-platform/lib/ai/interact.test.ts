import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  agentChain,
  DEFAULT_AGENTS,
  generateWithFallback,
  looksLikeUpstreamError,
  resetTokenCache,
  AllAgentsFailedError,
  InteractConfigError,
} from './interact';

function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}
const tokenResponse = () =>
  new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
const event = (content: string) => `data: ${JSON.stringify({ content })}\n`;

const agents = [
  { name: 'A', id: 'a' },
  { name: 'B', id: 'b' },
];

beforeEach(() => {
  resetTokenCache();
  vi.stubEnv('INTERACT_CLIENT_ID', 'id');
  vi.stubEnv('INTERACT_CLIENT_SECRET', 'secret');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('agentChain', () => {
  it('defaults to Sonnet, then Gemini 2.5 Pro, then Haiku', () => {
    expect(agentChain(undefined).map((a) => a.name)).toEqual(['Claude Sonnet 4.5', 'Gemini 2.5 Pro', 'Claude Haiku 4.5']);
  });
  it('accepts an env override and ignores malformed parts', () => {
    expect(agentChain('X:1, bad ,Y:2')).toEqual([
      { name: 'X', id: '1' },
      { name: 'Y', id: '2' },
    ]);
    expect(agentChain('garbage')).toBe(DEFAULT_AGENTS);
  });
});

describe('looksLikeUpstreamError', () => {
  it('flags error names and empty output, not real prose', () => {
    expect(looksLikeUpstreamError('AnthropicOverloadedError')).toBe(true);
    expect(looksLikeUpstreamError('')).toBe(true);
    expect(looksLikeUpstreamError('{"headline": "China leads on wealth"}')).toBe(false);
  });
});

describe('generateWithFallback', () => {
  it('assembles streamed content from the first agent', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sse([event('{"ok":'), 'data: [DONE]\n', event('true}')]));
    const r = await generateWithFallback('p', (raw) => (raw === '{"ok":true}' ? raw : null), { agents });
    expect(r.agent).toBe('A');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/agents/a/stream');
  });

  it('falls through on an upstream error string and on an unusable answer', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sse([event('not json at all, just a long rambling answer')]))
      .mockResolvedValueOnce(sse([event('{"ok":true}')]));
    const r = await generateWithFallback('p', (raw) => (raw.startsWith('{') ? raw : null), { agents });
    expect(r.agent).toBe('B');
    expect(r.attempts).toEqual([
      { agent: 'A', outcome: 'unusable' },
      { agent: 'B', outcome: 'ok' },
    ]);
  });

  it('falls through when an agent call fails over HTTP', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(sse([event('{"ok":true}')]));
    const r = await generateWithFallback('p', (raw) => raw, { agents });
    expect(r.agent).toBe('B');
  });

  it('throws AllAgentsFailedError when every agent fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sse([event('OverloadedError')]))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(generateWithFallback('p', (raw) => raw, { agents })).rejects.toBeInstanceOf(AllAgentsFailedError);
  });

  it('reuses the token across calls', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sse([event('x')]))
      .mockResolvedValueOnce(sse([event('y')]));
    await generateWithFallback('p', (raw) => raw, { agents });
    await generateWithFallback('p', (raw) => raw, { agents });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports missing credentials as a config error', async () => {
    vi.stubEnv('INTERACT_CLIENT_ID', '');
    await expect(generateWithFallback('p', (raw) => raw, { agents })).rejects.toBeInstanceOf(InteractConfigError);
  });
});
