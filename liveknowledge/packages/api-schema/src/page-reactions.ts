// Reactions on a page (docs/specs/030-knowledgebase/page-reactions.md) on the wire: the reactions a page holds, one
// change to them, the room op that tells everyone on the page, the bounds, and the one check an emoji goes through.
// The api stores them (apps/api/src/knowledge/page-reactions.ts); the editor draws them.

/** The most reactions a page holds, different emoji on a page, and different emoji one person puts on a page. */
export const PAGE_REACTIONS_MAX = 500;
export const PAGE_REACTION_EMOJI_MAX = 20;
export const PERSON_PAGE_REACTIONS_MAX = 10;
/** How many reaction changes one person makes a minute in a knowledgebase. */
export const PAGE_REACTIONS_PER_MINUTE = 30;
/** The longest an emoji may be, in UTF-16 units: a family or a flag with its modifiers fits well inside. */
export const REACTION_EMOJI_MAX_LENGTH = 32;

/** One person's emoji on a page. `by` is their collab key (the platform's public id for a person), so a client knows
 *  its own without anyone's account id on the wire; `name` is their name when they reacted. */
export type PageReaction = { emoji: string; by: string; name: string };

/** `GET .../pages/<tab>/reactions`: every reaction on the page, oldest first. */
export type PageReactionsResponse = { reactions: PageReaction[] };

/** `POST .../pages/<tab>/reactions`: add (`on`) or take back the caller's own. `name`, the name on the caller's
 *  cursor, is used only when their account has no profile name to give. */
export type PageReactionChange = { emoji: string; on: boolean; name?: string };

/** The reaction as asked, and whether a row moved (false when it already stood so). */
export type PageReactionChangeResponse = { reaction: PageReaction; on: boolean; changed: boolean };

/** The room op the api sends after each change that moved a row (from the system; a client never sends one). */
export type PageReactionOp = {
  kind: 'page-reaction';
  tabId: string;
  reaction: PageReaction;
  on: boolean;
};

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const KEYCAP = /^[0-9#*]️?⃣$/u;

let segmenter: Intl.Segmenter | null = null;
const graphemes = (text: string): number => {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(text)) count++;
  return count;
};

/** Whether `value` is one emoji: a single grapheme of at most REACTION_EMOJI_MAX_LENGTH units that is a pictograph,
 *  a flag or a keycap. Text, two emoji, or an empty string is not. */
export function isReactionEmoji(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > REACTION_EMOJI_MAX_LENGTH) return false;
  if (value.trim() !== value) return false;
  if (!PICTOGRAPHIC.test(value) && !KEYCAP.test(value)) return false;
  return graphemes(value) === 1;
}
