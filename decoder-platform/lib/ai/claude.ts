/**
 * Direct Claude API client: the primary AI path. Server-only:
 * CLAUDE_AGENT_API_KEY never reaches the browser.
 * CLAUDE_MODEL overrides the model without a code change.
 */
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';

const apiKey = () => process.env.CLAUDE_AGENT_API_KEY?.trim() || '';
export const claudeModel = () => process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;
export const claudeConfigured = () => Boolean(apiKey());

let client: Anthropic | null = null;
let clientKey = '';
function getClient(): Anthropic {
  const key = apiKey();
  if (!client || clientKey !== key) {
    // One retry, and a timeout that leaves the Interact fallback room inside
    // the route's maxDuration.
    client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 });
    clientKey = key;
  }
  return client;
}

/** Sends one prompt and returns the reply text plus the model that answered.
 * A refusal (after the server-side fallback) comes back as empty text. */
export async function callClaude(prompt: string, signal?: AbortSignal): Promise<{ text: string; model: string }> {
  const response = await getClient().beta.messages.create(
    {
      model: claudeModel(),
      max_tokens: 16000,
      // On a safety decline the API re-runs the request on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    },
    { signal }
  );
  if (response.stop_reason === 'refusal') return { text: '', model: response.model };
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  return { text, model: response.model };
}
