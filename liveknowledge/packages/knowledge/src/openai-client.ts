// The one call to the OpenAI Responses API (docs/specs/030-knowledgebase/search-and-ask.md "Providers"), streamed.
// As with the Claude client, `fetch` and the team's key are handed in: the key appears in the request's
// `Authorization` header and nowhere else, and a failure is one of the kinds a person can be told in words.
// Shapes read on 2026-11-20 from https://developers.openai.com/api/docs/guides/streaming-responses,
// https://developers.openai.com/api/docs/guides/error-codes and the stream event types of OpenAI's own SDK
// (github.com/openai/openai-node, src/resources/responses/responses.ts).
import { ModelCallError, type ModelFailureKind } from './model-failure';
import { OPENAI_RESPONSES_URL, type OpenAiRequest } from './openai-request';
import { eventData, parseEvent } from './sse';

/** A failed OpenAI call. Its message is the kind's words; it holds no key, no request and no API message. */
export class OpenAiCallError extends ModelCallError {
  constructor(kind: ModelFailureKind, status?: number) {
    super('openai', kind, status);
    this.name = 'OpenAiCallError';
  }
}

// `error.code` (or `error.type`) of a failure. The billing codes come with a 429, which is otherwise a rate to
// wait out: the code is what tells them apart.
const KIND_OF_CODE: Readonly<Record<string, ModelFailureKind>> = {
  invalid_api_key: 'bad-key',
  insufficient_quota: 'no-credit',
  credit_balance_exhausted: 'no-credit',
  organization_spend_limit_exceeded: 'no-credit',
  project_spend_limit_exceeded: 'no-credit',
  organization_usage_limit_exceeded: 'no-credit',
  rate_limit_exceeded: 'rate-limited',
  rate_limit_error: 'rate-limited',
  slow_down: 'rate-limited',
  server_is_overloaded: 'overloaded',
  service_unavailable_error: 'overloaded',
  model_not_found: 'model-unavailable',
  // A response the safety systems stopped (`response.failed`).
  invalid_prompt: 'refused',
  bio_policy: 'refused',
  misalignment_policy_violation: 'refused',
};

const KIND_OF_STATUS: Readonly<Record<number, ModelFailureKind>> = {
  401: 'bad-key',
  404: 'model-unavailable',
  429: 'rate-limited',
  503: 'overloaded',
};

type ErrorFields = { code?: unknown; type?: unknown };

const kindOfFields = (error: ErrorFields | null | undefined): ModelFailureKind | undefined =>
  (typeof error?.code === 'string' ? KIND_OF_CODE[error.code] : undefined) ??
  (typeof error?.type === 'string' ? KIND_OF_CODE[error.type] : undefined);

/** The kind of a failure from its HTTP status and the API's error body
 *  (`{ error: { message, type, param, code } }`). */
export function openAiFailureKind(status: number | undefined, body: unknown): ModelFailureKind {
  const error = (body as { error?: ErrorFields } | null)?.error;
  return (
    kindOfFields(error) ?? (status === undefined ? undefined : KIND_OF_STATUS[status]) ?? 'other'
  );
}

/** The headers of a request. The key goes here and nowhere else. */
export const openAiHeaders = (apiKey: string): Record<string, string> => ({
  'content-type': 'application/json',
  authorization: `Bearer ${apiKey}`,
});

export type OpenAiReply = {
  /** The answer's text: every `response.output_text.delta` of the stream, in order. */
  text: string;
  /** `end_turn`, or `max_tokens` when the answer was cut off at `max_output_tokens`. */
  stopReason: string;
  /** The model that answered. */
  model: string;
};

type StreamEvent = {
  type?: unknown;
  delta?: unknown;
  code?: unknown;
  response?: {
    model?: unknown;
    error?: ErrorFields | null;
    incomplete_details?: { reason?: unknown } | null;
  };
};

/** Sends `request` and reads the streamed answer, calling `onText` with each piece of text as it arrives. Throws
 *  OpenAiCallError for every failure: no network, a refused key, no quota, a rate limit, an overloaded API, a
 *  model the key cannot use, an answer the model declined, a stream that ended early. */
export async function callOpenAi(options: {
  fetch: typeof fetch;
  apiKey: string;
  request: OpenAiRequest;
  onText?: (text: string) => void;
  signal?: AbortSignal;
}): Promise<OpenAiReply> {
  const { request } = options;
  let response: Response;
  try {
    response = await options.fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: openAiHeaders(options.apiKey),
      body: JSON.stringify(request),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // Whatever the network said is not passed on: an error from `fetch` may describe the request.
    throw new OpenAiCallError('other');
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new OpenAiCallError(openAiFailureKind(response.status, body), response.status);
  }
  if (!response.body) throw new OpenAiCallError('other', response.status);

  let text = '';
  let stopReason = '';
  let model = request.model;
  let refused = false;
  try {
    for await (const data of eventData(response.body)) {
      const event = parseEvent<StreamEvent>(data);
      if (!event) continue;
      if (typeof event.response?.model === 'string') model = event.response.model;
      if (event.type === 'error') {
        throw new OpenAiCallError(kindOfFields(event) ?? 'other', response.status);
      } else if (event.type === 'response.failed') {
        throw new OpenAiCallError(kindOfFields(event.response?.error) ?? 'other', response.status);
      } else if (event.type === 'response.output_text.delta') {
        const piece = typeof event.delta === 'string' ? event.delta : '';
        text += piece;
        if (piece) options.onText?.(piece);
      } else if (event.type === 'response.refusal.delta') {
        refused = true;
      } else if (event.type === 'response.completed') {
        stopReason = 'end_turn';
      } else if (event.type === 'response.incomplete') {
        // Cut off at the token ceiling is an answer, as far as it got; stopped by a content filter is a refusal.
        if (event.response?.incomplete_details?.reason === 'max_output_tokens') {
          stopReason = 'max_tokens';
        } else refused = true;
      }
    }
  } catch (error) {
    if (error instanceof OpenAiCallError) throw error;
    // The connection dropped mid-answer, or the caller's `onText` threw.
    throw new OpenAiCallError('other', response.status);
  }
  if (refused) throw new OpenAiCallError('refused', response.status);
  if (!stopReason) throw new OpenAiCallError('other', response.status);
  return { text, stopReason, model };
}
