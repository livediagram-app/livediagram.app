// The one call to the Claude API (liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md "Ask"), streamed. `fetch` and the
// team's key are handed in: this package reads no environment, and the key appears in the request's `x-api-key`
// header and nowhere else: never in a log, a thrown error or a result. A failure is one of a few kinds a person
// can be told in words; the API's own message is not passed on.
import {
  CLAUDE_API_VERSION,
  CLAUDE_FALLBACK_BETA,
  CLAUDE_MESSAGES_URL,
  type ClaudeRequest,
} from './claude-request';
import { ModelCallError, modelFailureWords, type ModelFailureKind } from './model-failure';
import { eventData, parseEvent } from './sse';

/** The kinds are every provider's (model-failure.ts). */
export type ClaudeFailureKind = ModelFailureKind;

const CLAUDE_KINDS: readonly ModelFailureKind[] = [
  'bad-key',
  'no-credit',
  'rate-limited',
  'overloaded',
  'model-unavailable',
  'refused',
  'other',
];

/** What a person is told for each kind of failure of a Claude call. */
export const CLAUDE_FAILURE_WORDS = Object.fromEntries(
  CLAUDE_KINDS.map((kind) => [kind, modelFailureWords('anthropic', kind)]),
) as Readonly<Record<ClaudeFailureKind, string>>;

/** A failed Claude call. Its message is the kind's words; it holds no key, no request and no API message. */
export class ClaudeCallError extends ModelCallError {
  constructor(kind: ClaudeFailureKind, status?: number) {
    super('anthropic', kind, status);
    this.name = 'ClaudeCallError';
  }
}

const KIND_OF_TYPE: Readonly<Record<string, ClaudeFailureKind>> = {
  authentication_error: 'bad-key',
  permission_error: 'bad-key',
  billing_error: 'no-credit',
  rate_limit_error: 'rate-limited',
  overloaded_error: 'overloaded',
  not_found_error: 'model-unavailable',
};

const KIND_OF_STATUS: Readonly<Record<number, ClaudeFailureKind>> = {
  401: 'bad-key',
  402: 'no-credit',
  403: 'bad-key',
  404: 'model-unavailable',
  429: 'rate-limited',
  529: 'overloaded',
};

type ErrorBody = { error?: { type?: unknown; details?: { error_code?: unknown } } };

/** The kind of a failure from its HTTP status and the API's error body
 *  (`{ type: "error", error: { type, message, details? } }`). A 429 for a spend cap is the account out of credit,
 *  not a rate to wait out. */
export function claudeFailureKind(status: number | undefined, body: unknown): ClaudeFailureKind {
  const error = (body as ErrorBody | null)?.error;
  if (error?.details?.error_code === 'enforced_spend_limit_reached') return 'no-credit';
  const byType = typeof error?.type === 'string' ? KIND_OF_TYPE[error.type] : undefined;
  return byType ?? (status === undefined ? undefined : KIND_OF_STATUS[status]) ?? 'other';
}

/** The headers of a request. The key goes here and nowhere else. */
export function claudeHeaders(apiKey: string, request: ClaudeRequest): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': CLAUDE_API_VERSION,
    ...(request.fallbacks ? { 'anthropic-beta': CLAUDE_FALLBACK_BETA } : {}),
  };
}

export type ClaudeReply = {
  /** The answer's text: every `text_delta` of the stream, in order. */
  text: string;
  /** Why the model stopped: `end_turn`, or `max_tokens` when the answer was cut off. */
  stopReason: string;
  /** The model that answered (another than the one asked for when a fallback answered). */
  model: string;
};

type StreamEvent = {
  type?: unknown;
  message?: { model?: unknown };
  delta?: { type?: unknown; text?: unknown; stop_reason?: unknown };
  error?: unknown;
};

/** Sends `request` and reads the streamed answer, calling `onText` with each piece of text as it arrives. Throws
 *  ClaudeCallError for every failure: no network, a refused key, no credit, a rate limit, an overloaded API, a
 *  model the key cannot use, an answer the model declined, a stream that ended early. */
export async function callClaude(options: {
  fetch: typeof fetch;
  apiKey: string;
  request: ClaudeRequest;
  onText?: (text: string) => void;
  signal?: AbortSignal;
}): Promise<ClaudeReply> {
  const { request } = options;
  let response: Response;
  try {
    response = await options.fetch(CLAUDE_MESSAGES_URL, {
      method: 'POST',
      headers: claudeHeaders(options.apiKey, request),
      body: JSON.stringify(request),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // Whatever the network said is not passed on: an error from `fetch` may describe the request.
    throw new ClaudeCallError('other');
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ClaudeCallError(claudeFailureKind(response.status, body), response.status);
  }
  if (!response.body) throw new ClaudeCallError('other', response.status);

  let text = '';
  let stopReason = '';
  let model = request.model;
  let finished = false;
  try {
    for await (const data of eventData(response.body)) {
      const event = parseEvent<StreamEvent>(data);
      if (!event) continue;
      if (event.type === 'error') throw new ClaudeCallError(claudeFailureKind(undefined, event));
      if (event.type === 'message_start' && typeof event.message?.model === 'string') {
        model = event.message.model;
      } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const piece = typeof event.delta.text === 'string' ? event.delta.text : '';
        text += piece;
        if (piece) options.onText?.(piece);
      } else if (event.type === 'message_delta' && typeof event.delta?.stop_reason === 'string') {
        stopReason = event.delta.stop_reason;
      } else if (event.type === 'message_stop') {
        finished = true;
      }
    }
  } catch (error) {
    if (error instanceof ClaudeCallError) throw error;
    // The connection dropped mid-answer, or the caller's `onText` threw.
    throw new ClaudeCallError('other', response.status);
  }
  if (!finished) throw new ClaudeCallError('other', response.status);
  if (stopReason === 'refusal') throw new ClaudeCallError('refused', response.status);
  return { text, stopReason, model };
}
