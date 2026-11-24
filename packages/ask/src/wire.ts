// What Ask AI's one route takes and answers (liveworkspace/docs/specs/020-ask/ask.md "The route"): `POST /api/ask`
// with the question, the passages chosen for it and the conversation so far; answered as server-sent events
// (`AskEvent`): `delta` pieces of the answer, then one `done` with the sources it cites, or one `error`. A refusal
// before the stream opens is JSON, `{ error, message }`.
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import type { AskPassage } from './passages';
import type { AskTurn } from './request';

export const ASK_PATH = 'ask';

export type AskRequestBody = {
  question: string;
  passages: AskPassage[];
  /** The conversation so far, oldest first. */
  turns?: AskTurn[];
  /** The item's team, for its key. Accounts reads the membership itself: a team the person is not in answers none. */
  teamId?: string | null;
  /** `built-in`: the person chose built-in AI over the key that applies. */
  ai?: 'built-in';
  /** The open item, read with Pro on only, to learn who pays a built-in question's AI credit (the index's word). */
  itemId?: string;
};

/** Which AI answered: built-in AI, or the provider of the key. */
export type AskProvider = 'built-in' | 'anthropic' | 'openai';

/** A passage the answer cites, under the number the answer shows (1 first, as first cited). */
export type AskSource = AskPassage & { number: number };

export type AskEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; sources: AskSource[]; provider: AskProvider; model: string }
  | {
      type: 'error';
      /** The refusal's code or the model failure's kind. */
      kind: string;
      message: string;
      provider?: AskProvider;
      /** A key the provider refused or that will not open: whose, and how (never the key). */
      aiKey?: AiKeyFailure;
      /** With Pro on, the AI credits that refused it: whose month (`p:` or `t:` scope) and, for the owner's side
       *  alone, what is used of how many. */
      credits?: AskCreditsUsed;
    };

/** A refusal for the month's AI credits, as the tool reads it. */
export type AskCreditsUsed = { owner: string; used?: number; max?: number };

/** The refusals the route answers before any stream, by `error`. */
export type AskRefusalCode =
  | 'ask_needs_account'
  | 'ask_invalid'
  | 'ask_nothing_to_read'
  | 'ask_unavailable'
  | 'ask_built_in_limit'
  | 'ai_key_failed'
  // With Pro on: the payer's month of AI credits is used, or the item's questions charged to its owner by others.
  | 'ai_credits_used'
  | 'ask_by_others_limit';

export const isAskEvent = (value: unknown): value is AskEvent => {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'delta' || type === 'done' || type === 'error';
};
