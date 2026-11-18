/**
 * AI generation with a two-tier chain: the Claude API first (when
 * CLAUDE_AGENT_API_KEY is set), then the Omni/Interact agent chain.
 */
import { callClaude, claudeConfigured } from './claude';
import { AllAgentsFailedError, generateWithFallback, InteractConfigError, type Generated } from './interact';

export async function generate<T>(
  prompt: string,
  accept: (raw: string) => T | null,
  opts: { signal?: AbortSignal } = {}
): Promise<Generated<T>> {
  const attempts: Generated<T>['attempts'] = [];

  if (claudeConfigured()) {
    try {
      const { text, model } = await callClaude(prompt, opts.signal);
      const value = text ? accept(text) : null;
      if (value !== null) {
        attempts.push({ agent: model, outcome: 'ok' });
        return { result: value, agent: model, attempts };
      }
      attempts.push({ agent: model, outcome: 'unusable' });
      console.warn(`[ai] Claude API returned an unusable answer (${text.slice(0, 80)})`);
    } catch (err) {
      attempts.push({ agent: 'Claude API', outcome: 'error' });
      console.warn('[ai] Claude API failed:', err instanceof Error ? err.message : err);
    }
  }

  try {
    const r = await generateWithFallback(prompt, accept, opts);
    return { ...r, attempts: [...attempts, ...r.attempts] };
  } catch (err) {
    // With no Claude attempt, keep Interact's own error (config vs outage).
    if (!attempts.length) throw err;
    if (err instanceof AllAgentsFailedError) throw new AllAgentsFailedError([...attempts, ...err.attempts]);
    if (!(err instanceof InteractConfigError)) {
      console.warn('[ai] Interact fallback failed:', err instanceof Error ? err.message : err);
    }
    throw new AllAgentsFailedError([...attempts, { agent: 'Interact', outcome: 'error' }]);
  }
}
