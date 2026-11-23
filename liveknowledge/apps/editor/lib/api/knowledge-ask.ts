// Ask from the editor (docs/specs/030-knowledgebase/search-and-ask.md "Ask"; api.md "Knowledge"): one POST whose
// answer streams back as server-sent events (`AskEvent`): `delta` pieces, then one `done`, or one `error`. A refusal
// before the stream opens (no key, a limit, not signed in) arrives as JSON and is handed on as an `error` event with
// the server's own words, so the Ask tab has one shape to show.
import type { AskEvent, AskRequest } from '@liveknowledge/api-schema';
import { readEvents } from '@liveworkspace/ask';
import { apiFetch } from './core';
import { knowledgeHeaders, knowledgeUrl, type KnowledgeCaller } from './knowledge';

export type AskOutcome = Extract<AskEvent, { type: 'done' | 'error' }>;

/** What a stream that ended with neither `done` nor `error` says. */
export const ASK_CUT_SHORT = 'The answer stopped before it finished. Ask again.';
const ASK_FAILED = 'The question could not be asked. Check your connection and ask again.';

const failure = (kind: string, message: string): AskOutcome => ({ type: 'error', kind, message });

function isAskEvent(value: unknown): value is AskEvent {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'delta' || type === 'done' || type === 'error';
}

/** The events of one server-sent-events body, in order (the platform's reader, shared with every other app's Ask
 *  AI): data that is not an `AskEvent` is skipped. */
export const readAskEvents = (body: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> =>
  readEvents(body, isAskEvent);

/** Ask the knowledgebase a question. `onDelta` is handed each piece of the answer as it arrives; the promise
 *  answers the `done` event, or an `error` event for a refusal, a failed model call or a stream cut short. It
 *  rejects only when `signal` aborts it. */
export async function apiAskKnowledge(
  who: KnowledgeCaller,
  documentId: string,
  request: AskRequest,
  opts: { onDelta?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<AskOutcome> {
  let res: Response;
  try {
    res = await apiFetch(knowledgeUrl(documentId, 'ask'), {
      method: 'POST',
      headers: { ...(await knowledgeHeaders(who, true)), Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal: opts.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return failure('network', ASK_FAILED);
  }
  if (!res.ok || !res.body) {
    const refusal = (await res.json().catch(() => null)) as {
      error?: unknown;
      message?: unknown;
    } | null;
    return failure(
      typeof refusal?.error === 'string' ? refusal.error : 'other',
      typeof refusal?.message === 'string' ? refusal.message : ASK_FAILED,
    );
  }
  try {
    for await (const event of readAskEvents(res.body)) {
      if (event.type === 'delta') opts.onDelta?.(event.text);
      else return event;
    }
  } catch (err) {
    if (opts.signal?.aborted) throw err;
  }
  return failure('other', ASK_CUT_SHORT);
}
