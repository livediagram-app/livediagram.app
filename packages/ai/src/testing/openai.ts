// Fake OpenAI Responses API responses for the tests, in the shapes OpenAI documents: typed server-sent events for
// a streamed answer (`response.created`, `response.output_text.delta`, `response.completed`, ...) and
// `{ error: { message, type, param, code } }` for a failure. No test calls the API.

let sequence = 0;
const sse = (event: Record<string, unknown>) =>
  `event: ${String(event.type)}\ndata: ${JSON.stringify({ ...event, sequence_number: sequence++ })}\n\n`;

const responseOf = (status: string, model: string, more: Record<string, unknown> = {}) => ({
  id: 'resp_01',
  object: 'response',
  status,
  model,
  error: null,
  incomplete_details: null,
  ...more,
});

const delta = (text: string) =>
  sse({
    type: 'response.output_text.delta',
    item_id: 'msg_01',
    output_index: 1,
    content_index: 0,
    delta: text,
    logprobs: [],
  });

/** The events of a streamed answer whose text arrives as `pieces`, up to its last event. */
export function openAiOpening(pieces: readonly string[], model = 'gpt-6.2-astra'): string {
  return [
    sse({ type: 'response.created', response: responseOf('in_progress', model) }),
    sse({ type: 'response.in_progress', response: responseOf('in_progress', model) }),
    // Reasoning comes first and carries no text of the answer.
    sse({ type: 'response.output_item.added', output_index: 0, item: { type: 'reasoning' } }),
    sse({ type: 'response.output_item.done', output_index: 0, item: { type: 'reasoning' } }),
    sse({ type: 'response.output_item.added', output_index: 1, item: { type: 'message' } }),
    ...pieces.map(delta),
  ].join('');
}

/** A whole streamed answer. `end`: how it ended. */
export function openAiEvents(
  pieces: readonly string[],
  options: {
    model?: string;
    end?: 'completed' | 'max_output_tokens' | 'content_filter' | 'failed';
    failedCode?: string;
  } = {},
): string {
  const model = options.model ?? 'gpt-6.2-astra';
  const end = options.end ?? 'completed';
  const last =
    end === 'completed'
      ? sse({ type: 'response.completed', response: responseOf('completed', model) })
      : end === 'failed'
        ? sse({
            type: 'response.failed',
            response: responseOf('failed', model, {
              error: { code: options.failedCode ?? 'server_error', message: 'API said failed' },
            }),
          })
        : sse({
            type: 'response.incomplete',
            response: responseOf('incomplete', model, { incomplete_details: { reason: end } }),
          });
  return openAiOpening(pieces, model) + last;
}

/** A refusal: the model's refusal text streams in place of an answer, and the response completes. */
export function openAiRefusal(model = 'gpt-6.2-astra'): string {
  return (
    openAiOpening([], model) +
    sse({
      type: 'response.refusal.delta',
      item_id: 'msg_01',
      output_index: 1,
      content_index: 0,
      delta: 'API said no',
    }) +
    sse({ type: 'response.completed', response: responseOf('completed', model) })
  );
}

/** An `error` event, as the stream sends one. */
export const openAiErrorEvent = (code: string | null): string =>
  sse({ type: 'error', code, message: 'API said error', param: null });

/** A failure as the API answers it. */
export function openAiErrorResponse(
  status: number,
  error: { type?: string; code?: string | null } = {},
): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: 'API said no',
        type: error.type ?? 'invalid_request_error',
        param: null,
        code: error.code ?? null,
      },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}
