// `POST /api/ask` in every app (liveworkspace/docs/specs/019-ask/ask.md "The route"): a question answered from the
// passages of the open item the editor sent with it, on the person's own key (or their team's) when one applies and
// they did not choose built-in AI, else on built-in AI under its daily allowance. Streamed as server-sent events
// (`AskEvent`). For a signed-in account only: a guest or a link visitor would spend built-in AI for strangers.
//
// Pure of any app: the app's route hands in who is calling, how to ask accounts for the key, its `AI` binding and its
// count. Nothing here logs the question, the passages, the answer or any part of a key.
import {
  AI_KEY_FAILED,
  ModelCallError,
  callModel,
  isKeyFailureKind,
  modelFailureWords,
  ownKeyOf,
  type AiKeyFailure,
  type BuiltInAiBinding,
  type KeyAnswer,
  type ModelCaller,
} from '@liveworkspace/ai';
import { askAnswerStream } from '../answer';
import {
  ASK_BUILT_IN_PER_PERSON_PER_DAY,
  ASK_MAX_BODY_CHARS,
  ASK_MAX_ID_CHARS,
  ASK_MAX_QUESTION_CHARS,
} from '../limits';
import { readPassages } from '../passages';
import { askRequest, readTurns } from '../request';
import type { AskEvent, AskRefusalCode, AskSource } from '../wire';

export type AskDoor = {
  request: Request;
  /** The signed-in account asking, as the app verified it; null for a guest, a link visitor or nobody. */
  accountId: string | null;
  /** The app's word for its item, in a sentence ("diagram", "plan"). */
  itemWord: string;
  /** Asks accounts which key applies to the caller in `teamId`'s work, with the key (`personAiKey`). Null: no person
   *  to ask for (an API token, a server with no accounts), so built-in AI. */
  aiKey: (teamId: string | null) => Promise<KeyAnswer | null>;
  /** The app's `AI` binding; null where there is none. */
  builtIn: BuiltInAiBinding | null;
  /** Counts one built-in question for the account (`spendAsk`). */
  spend: (accountId: string, now: number) => Promise<boolean | 'unavailable'>;
  /** Headers every answer carries (the app's CORS headers). */
  headers?: Record<string, string>;
  /** The provider's API is called through this (tests hand a stand-in). */
  through?: typeof fetch;
  now?: () => number;
};

export const ASK_WORDS = {
  needsAccount: 'Sign in to ask AI.',
  noQuestion: 'Ask a question.',
  tooLong: `A question is at most ${ASK_MAX_QUESTION_CHARS.toLocaleString('en')} characters.`,
  badBody: 'The question could not be read. Ask again.',
  nothingToRead: (itemWord: string) =>
    `This ${itemWord} has no text to answer from yet. Add some and ask again.`,
  notSetUp: "Built-in AI isn't set up on this server. Add your own AI key in Settings to ask.",
  limit: `You have used today's ${ASK_BUILT_IN_PER_PERSON_PER_DAY} built-in questions. Try again tomorrow, or use your own AI key.`,
  countFailed: "The built-in AI couldn't answer just now. Try again in a moment.",
} as const;

const EVENT_STREAM = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store',
};

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (raw.length > ASK_MAX_BODY_CHARS) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function serveAsk(door: AskDoor): Promise<Response> {
  const { request, itemWord } = door;
  const headers = door.headers ?? {};
  const refuse = (
    status: number,
    error: AskRefusalCode,
    message: string,
    more: { aiKey?: AiKeyFailure } = {},
  ) =>
    new Response(JSON.stringify({ error, message, ...more }), {
      status,
      headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  const { accountId } = door;
  if (!accountId) return refuse(403, 'ask_needs_account', ASK_WORDS.needsAccount);
  const body = await bodyOf(request);
  if (!body) return refuse(400, 'ask_invalid', ASK_WORDS.badBody);
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return refuse(400, 'ask_invalid', ASK_WORDS.noQuestion);
  if (question.length > ASK_MAX_QUESTION_CHARS)
    return refuse(400, 'ask_invalid', ASK_WORDS.tooLong);
  const passages = readPassages(body.passages);
  if (passages.length === 0)
    return refuse(422, 'ask_nothing_to_read', ASK_WORDS.nothingToRead(itemWord));
  const teamId =
    typeof body.teamId === 'string' && body.teamId !== '' && body.teamId.length <= ASK_MAX_ID_CHARS
      ? body.teamId
      : null;
  const clock = door.now ?? Date.now;
  const now = clock();

  // Which AI answers (ai-keys.md "Every AI feature honours the choice"): built-in AI when the person chose it, else
  // the key that applies, else built-in AI. A key that will not open, or accounts that could not say, is refused in
  // words, never swapped for built-in AI on a guess.
  let caller: ModelCaller;
  // On a key: whose it is and whose API, for a failure the person fixes in Settings.
  let keyed: Pick<AiKeyFailure, 'source' | 'provider'> | null = null;
  const own =
    body.ai === 'built-in'
      ? ({ status: 'built-in' } as const)
      : ownKeyOf(await door.aiKey(teamId), door.through);
  if (own.status === 'refused')
    return own.reason === 'unreadable'
      ? refuse(422, AI_KEY_FAILED, own.words, { aiKey: own.failure })
      : refuse(503, 'ask_unavailable', own.words);
  if (own.status === 'key') {
    caller = own.caller;
    keyed = { source: own.source, provider: own.provider };
  } else {
    if (!door.builtIn) return refuse(503, 'ask_unavailable', ASK_WORDS.notSetUp);
    // The allowance is built-in AI's: counted before the model is called, and only here.
    const spent = await door.spend(accountId, now);
    if (spent === 'unavailable') return refuse(503, 'ask_unavailable', ASK_WORDS.countFailed);
    if (!spent) return refuse(429, 'ask_built_in_limit', ASK_WORDS.limit);
    caller = { provider: 'built-in', ai: door.builtIn };
  }

  const { provider } = caller;
  const turns = readTurns(body.turns);
  const modelRequest = askRequest({ itemWord, question, passages, turns });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) =>
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      const answer = askAnswerStream(passages);
      const started = clock();
      try {
        const reply = await callModel({
          ...caller,
          request: modelRequest,
          signal: request.signal,
          onText: (piece) => {
            const text = answer.push(piece);
            if (text) send({ type: 'delta', text });
          },
        });
        const read = answer.finish();
        // Each source under the number the answer shows (1 first, as first cited), not the one it was sent as.
        const byNumber = new Map(passages.map((p) => [p.number, p.passage]));
        // The reader cites only numbers that were sent, so each is found.
        const sources: AskSource[] = read.cited.map((cited) => ({
          ...byNumber.get(cited.sent)!,
          number: cited.number,
        }));
        console.info('[ask] answered', {
          passages: passages.length,
          cited: sources.length,
          turns: turns.length,
          provider,
          model: reply.model,
          tookMs: clock() - started,
        });
        send({ type: 'done', text: read.text, sources, provider, model: reply.model });
      } catch (error) {
        // The kind and its fixed words; never the upstream's own message, the request or the key.
        const kind = error instanceof ModelCallError ? error.kind : 'other';
        console.warn('[ask] failed', { provider, kind });
        const aiKey = keyed && isKeyFailureKind(kind) ? { ...keyed, kind } : null;
        send({
          type: 'error',
          kind: aiKey ? AI_KEY_FAILED : kind,
          provider,
          message: modelFailureWords(provider, kind),
          ...(aiKey ? { aiKey } : {}),
        });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...headers, ...EVENT_STREAM } });
}
