// Fake Claude API responses for the tests, in the shapes the Messages API documents: a server-sent event stream
// for a streamed answer, and `{ type: "error", error: { type, message } }` for a failure. No test calls the API.

const sse = (event: Record<string, unknown>) =>
  `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`;

/** The events of a streamed answer whose text arrives as `pieces`. */
export function answerEvents(
  pieces: readonly string[],
  options: { stopReason?: string; model?: string } = {},
): string {
  return [
    sse({
      type: 'message_start',
      message: {
        id: 'msg_01',
        type: 'message',
        role: 'assistant',
        model: options.model ?? 'claude-fable-5-2',
      },
    }),
    // Thinking comes first and carries no text of the answer.
    sse({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'thinking', thinking: '' },
    }),
    sse({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'signature_delta', signature: 'sig' },
    }),
    sse({ type: 'content_block_stop', index: 0 }),
    'event: ping\ndata: {"type":"ping"}\n\n',
    sse({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }),
    ...pieces.map((text) =>
      sse({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } }),
    ),
    sse({ type: 'content_block_stop', index: 1 }),
    sse({
      type: 'message_delta',
      delta: { stop_reason: options.stopReason ?? 'end_turn' },
      usage: { output_tokens: 12 },
    }),
    sse({ type: 'message_stop' }),
  ].join('');
}

/** A response whose body streams `text` in chunks of `chunk` bytes, so events arrive split anywhere. */
export function streamResponse(text: string, chunk = 37): Response {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(at, at + chunk));
      at += chunk;
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** A failure as the API answers it. */
export function errorResponse(
  status: number,
  type: string,
  details?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      error: { type, message: `API said ${type}`, ...(details ? { details } : {}) },
      request_id: 'req_011CSHoEeqs5C35K2UUqR7Fy',
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

export type SentRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

/** A `fetch` that answers with `respond` and records what it was sent. */
export function fakeFetch(respond: () => Response | Promise<Response>) {
  const sent: SentRequest[] = [];
  const fake = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    sent.push({
      url,
      headers: init.headers,
      body: JSON.parse(init.body) as Record<string, unknown>,
    });
    return respond();
  };
  const fetch = fake as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}
