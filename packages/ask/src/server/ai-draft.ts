// One AI operation on an item, asked on Ask's rules (liveworkspace/docs/specs/020-ask/ask.md "Which AI answers"):
// the key that applies unless built-in AI was chosen, else built-in AI on Ask's daily count, and with Pro on one
// credit from whoever pays for the item, spent only once the operation has its answer (a failure, a refusal or a
// cancelled request costs nothing). Send to Knowledge Base's summary (serve-summary.ts) and livedocuments' Describe a
// Page ask through it, so every such operation picks its AI, counts and charges alike. An operation may ask the model
// more than once (Describe a Page picks a layout, then writes it): the day's count and the credit are spent once.
// Nothing here logs what is asked or answered.
import {
  AI_KEY_FAILED,
  ModelCallError,
  callModel,
  isKeyFailureKind,
  modelFailureWords,
  ownKeyOf,
  type AiKeyFailure,
  type ModelCaller,
  type ModelRequest,
} from '@liveworkspace/ai';
import { chargeAsk } from './ask-credits';
import type { AskDoor } from './serve-ask';

/** Ask's door for an operation on one item: the item is the route's own, so no item word. */
export type ItemAiDoor = Omit<AskDoor, 'itemWord'> & { itemId: string };

/** The operation's own refusal codes: `<op>_unavailable` (503), `<op>_built_in_limit` (429), `<op>_failed` (502). */
export type AiDraftCodes<C extends string = string> = { unavailable: C; limit: C; failed: C };

/** The refusals every operation shares, whoever's they are. */
export type AiDraftSharedCode = typeof AI_KEY_FAILED | 'ai_credits_used' | 'ask_by_others_limit';

/** The operation's own words for the refusals it says in them. */
export type AiDraftWords = {
  /** No built-in AI on this server, and no key. */
  notSetUp: string;
  /** Today's built-in AI is used. */
  limit: string;
  /** The day's count could not be read. */
  countFailed: string;
  /** This month's AI credits are used. */
  used: string;
};

/** A refusal as the route answers it: its status, code, fixed words and anything more the body carries. */
export type AiDraftRefuse<C extends string = string> = (
  status: number,
  error: C | AiDraftSharedCode,
  message: string,
  more?: Record<string, unknown>,
) => Response;

export type AiDraft = {
  /** Which AI asks: `built-in`, or the key's provider. */
  provider: string;
  /** One model call: its text and the model that wrote it, or the refusal to answer (a key's failure, said as one). */
  ask(request: ModelRequest): Promise<{ text: string; model: string } | { refused: Response }>;
  /** The operation's credit (Pro on, built-in AI only), now its answer is in hand: null to answer it, else the
   *  refusal to answer instead. */
  charge(cost: number): Promise<Response | null>;
};

/** The AI the operation asks, its day counted, or the refusal before any model is asked. */
export async function openAiDraft<C extends string>(
  door: ItemAiDoor,
  opts: {
    accountId: string;
    teamId: string | null;
    // The person chose built-in AI for this operation, though a key applies.
    builtInChosen: boolean;
    codes: AiDraftCodes<C>;
    words: AiDraftWords;
    refuse: AiDraftRefuse<C>;
    // The log line's name (`knowledge-summary`): a failure logs its kind, never the upstream's words.
    log: string;
  },
): Promise<AiDraft | { refused: Response }> {
  const { accountId, codes, words, refuse } = opts;
  const clock = door.now ?? Date.now;
  const own = opts.builtInChosen
    ? ({ status: 'built-in' } as const)
    : ownKeyOf(await door.aiKey(opts.teamId), door.through);
  if (own.status === 'refused')
    return {
      refused:
        own.reason === 'unreadable'
          ? refuse(422, AI_KEY_FAILED, own.words, { aiKey: own.failure })
          : refuse(503, codes.unavailable, own.words),
    };
  let caller: ModelCaller;
  let keyed: Pick<AiKeyFailure, 'source' | 'provider'> | null = null;
  if (own.status === 'key') {
    caller = own.caller;
    keyed = { source: own.source, provider: own.provider };
  } else {
    if (!door.builtIn) return { refused: refuse(503, codes.unavailable, words.notSetUp) };
    // Built-in AI's day, as Ask counts it: the operation is a question of the day's, however many asks it makes.
    const spent = await door.spend(accountId, clock());
    if (spent === 'unavailable')
      return { refused: refuse(503, codes.unavailable, words.countFailed) };
    if (!spent) return { refused: refuse(429, codes.limit, words.limit) };
    caller = { provider: 'built-in', ai: door.builtIn };
  }
  const builtIn = keyed === null;
  return {
    provider: caller.provider,
    async ask(request) {
      try {
        const reply = await callModel({ ...caller, request, signal: door.request.signal });
        return { text: reply.text, model: reply.model };
      } catch (error) {
        // The kind and its fixed words; never the upstream's own message, the request or the key.
        const kind = error instanceof ModelCallError ? error.kind : 'other';
        console.warn(`[${opts.log}] failed`, { provider: caller.provider, kind });
        const aiKey = keyed && isKeyFailureKind(kind) ? { ...keyed, kind } : null;
        return {
          refused: aiKey
            ? refuse(422, AI_KEY_FAILED, modelFailureWords(caller.provider, kind), { aiKey })
            : refuse(502, codes.failed, modelFailureWords(caller.provider, kind)),
        };
      }
    },
    async charge(cost) {
      if (!builtIn || !door.credits) return null;
      const refused = await chargeAsk(door.credits, accountId, door.itemId, clock(), cost);
      if (!refused) return null;
      if (refused.error === 'ai_credits_used')
        return refuse(refused.status, 'ai_credits_used', words.used, refused.more);
      if (refused.error === 'ask_by_others_limit')
        return refuse(refused.status, 'ask_by_others_limit', refused.message);
      return refuse(refused.status, codes.unavailable, refused.message);
    },
  };
}
