import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const callClaude = vi.fn();
vi.mock('./claude', () => ({
  callClaude: (...args: unknown[]) => callClaude(...args),
  claudeConfigured: () => Boolean(process.env.CLAUDE_AGENT_API_KEY),
}));

const generateWithFallback = vi.fn();
vi.mock('./interact', async (orig) => ({
  ...(await orig<typeof import('./interact')>()),
  generateWithFallback: (...args: unknown[]) => generateWithFallback(...args),
}));

const { generate } = await import('./generate');
const { AllAgentsFailedError, InteractConfigError } = await import('./interact');

const accept = (raw: string) => (raw.startsWith('{') ? raw : null);
const interactOk = { result: '{"via":"interact"}', agent: 'Gemini 2.5 Pro', attempts: [{ agent: 'Gemini 2.5 Pro', outcome: 'ok' }] };

beforeEach(() => {
  vi.stubEnv('CLAUDE_AGENT_API_KEY', 'key');
  callClaude.mockReset();
  generateWithFallback.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generate', () => {
  it('uses the Claude API first and skips Interact when it answers', async () => {
    callClaude.mockResolvedValue({ text: '{"via":"claude"}', model: 'claude-opus-5-5' });
    const r = await generate('p', accept);
    expect(r).toEqual({ result: '{"via":"claude"}', agent: 'claude-opus-5-5', attempts: [{ agent: 'claude-opus-5-5', outcome: 'ok' }] });
    expect(generateWithFallback).not.toHaveBeenCalled();
  });

  it('falls back to Interact when the Claude API throws', async () => {
    callClaude.mockRejectedValue(new Error('529 overloaded'));
    generateWithFallback.mockResolvedValue(interactOk);
    const r = await generate('p', accept);
    expect(r.agent).toBe('Gemini 2.5 Pro');
    expect(r.attempts.map((a) => a.outcome)).toEqual(['error', 'ok']);
  });

  it('falls back to Interact when the Claude answer is unusable or a refusal', async () => {
    callClaude.mockResolvedValueOnce({ text: 'not json', model: 'm' }).mockResolvedValueOnce({ text: '', model: 'm' });
    generateWithFallback.mockResolvedValue(interactOk);
    expect((await generate('p', accept)).attempts[0]).toEqual({ agent: 'm', outcome: 'unusable' });
    expect((await generate('p', accept)).attempts[0]).toEqual({ agent: 'm', outcome: 'unusable' });
  });

  it('goes straight to Interact when no Claude key is set', async () => {
    vi.stubEnv('CLAUDE_AGENT_API_KEY', '');
    generateWithFallback.mockResolvedValue(interactOk);
    await generate('p', accept);
    expect(callClaude).not.toHaveBeenCalled();
  });

  it('reports every attempt when both tiers fail', async () => {
    callClaude.mockRejectedValue(new Error('down'));
    generateWithFallback.mockRejectedValue(new AllAgentsFailedError([{ agent: 'Gemini 2.5 Pro', outcome: 'error' }]));
    const err = await generate('p', accept).catch((e) => e);
    expect(err).toBeInstanceOf(AllAgentsFailedError);
    expect(err.attempts).toEqual([
      { agent: 'Claude API', outcome: 'error' },
      { agent: 'Gemini 2.5 Pro', outcome: 'error' },
    ]);
  });

  it('turns an Interact token or config failure after a Claude failure into AllAgentsFailedError', async () => {
    callClaude.mockRejectedValue(new Error('down'));
    generateWithFallback.mockRejectedValueOnce(new Error('Omni token request failed: 401'));
    await expect(generate('p', accept)).rejects.toBeInstanceOf(AllAgentsFailedError);
    generateWithFallback.mockRejectedValueOnce(new InteractConfigError('missing'));
    await expect(generate('p', accept)).rejects.toBeInstanceOf(AllAgentsFailedError);
  });

  it('keeps the config error when neither tier is configured', async () => {
    vi.stubEnv('CLAUDE_AGENT_API_KEY', '');
    generateWithFallback.mockRejectedValue(new InteractConfigError('missing'));
    await expect(generate('p', accept)).rejects.toBeInstanceOf(InteractConfigError);
  });
});
