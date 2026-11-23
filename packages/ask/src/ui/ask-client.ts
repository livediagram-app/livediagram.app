// Ask AI from an editor (liveworkspace/docs/specs/019-ask/ask.md "The route"): one POST to the app's own api whose
// answer streams back as server-sent events (`AskEvent`): `delta` pieces, then one `done`, or one `error`. A refusal
// before the stream opens (not signed in, a limit, a key that failed) arrives as JSON and is handed on as an `error`
// event with the server's own words, so the tool has one shape to show.
import { readAiKeyFailure } from '@liveworkspace/ai/key-failure';
import { workbench } from '@liveworkspace/workbench/bindings';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';
import { readEvents } from '../events';
import { ASK_PATH, isAskEvent, type AskEvent, type AskRequestBody } from '../wire';

export type AskOutcome = Extract<AskEvent, { type: 'done' | 'error' }>;
export type AskSend = (
  body: AskRequestBody,
  opts: { onDelta: (text: string) => void; signal: AbortSignal },
) => Promise<AskOutcome>;

/** What a stream that ended with neither `done` nor `error` says. */
export const ASK_CUT_SHORT = 'The answer stopped before it finished. Ask again.';
export const ASK_FAILED = 'The question could not be asked. Check your connection and ask again.';

const failure = (kind: string, message: string): AskOutcome => ({ type: 'error', kind, message });

/** Asks as `accountId` through the editor's own api transport. The promise answers the `done` event, or an `error`
 *  event for a refusal, a failed model call or a stream cut short. It rejects only when `signal` aborts it. */
export const askSender =
  (accountId: string): AskSend =>
  async (body, { onDelta, signal }) => {
    let res: Response;
    try {
      res = await workbench.api.fetch(`${API_BASE}/${ASK_PATH}`, {
        method: 'POST',
        headers: {
          ...((await workbench.api.headers(accountId, { body: true })) as Record<string, string>),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      return failure('network', ASK_FAILED);
    }
    if (!res.ok || !res.body) {
      const refusal = (await res.json().catch(() => null)) as {
        error?: unknown;
        message?: unknown;
      } | null;
      const aiKey = readAiKeyFailure(refusal);
      return {
        ...failure(
          typeof refusal?.error === 'string' ? refusal.error : 'other',
          typeof refusal?.message === 'string' ? refusal.message : ASK_FAILED,
        ),
        ...(aiKey ? { aiKey } : {}),
      };
    }
    try {
      for await (const event of readEvents(res.body, isAskEvent)) {
        if (event.type === 'delta') onDelta(event.text);
        else return event;
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
    return failure('other', ASK_CUT_SHORT);
  };
