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

export const RECOMMEND_MODEL = 'claude-opus-5-5';

/**
 * One prompt with a JSON-schema-constrained reply, streamed so a long Opus
 * run doesn't hit HTTP timeouts. Returns the raw JSON text ('' on refusal).
 */
export async function callClaudeStructured(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ text: string; model: string }> {
  const client = new Anthropic({ apiKey: apiKey(), timeout: 280_000, maxRetries: 1 });
  const stream = client.messages.stream(
    {
      model: opts.model ?? claudeModel(),
      max_tokens: opts.maxTokens ?? 32000,
      output_config: {
        effort: opts.effort ?? 'high',
        format: { type: 'json_schema', schema: opts.schema },
      },
      messages: [{ role: 'user', content: opts.prompt }],
    },
    { signal: opts.signal }
  );
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') return { text: '', model: message.model };
  const text = message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  return { text, model: message.model };
}
