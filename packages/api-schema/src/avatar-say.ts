// A character saying something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): a short message that
// rises from above the speaker's head and floats away. Presence: relayed unordered from an Editor or a
// Participant, never logged, never replayed, never stored. The room and every receiver run the same parser,
// so a message is held to the same limits however it was sent.

export const AVATAR_SAY_MAX_WORDS = 50;
// Fifty words of six characters (docs/specs/008-canvas/blueprints/DEFAULTS.md D107), so one very long "word"
// cannot fill the canvas either.
export const AVATAR_SAY_MAX_CHARS = 300;
// Longer ids than any the editor mints are refused rather than drawn.
export const AVATAR_SAY_MAX_ID_LEN = 64;

export type AvatarSay = { tabId: string; id: string; text: string; x: number; y: number };
export type AvatarSayOp = { kind: 'avatar-say' } & AvatarSay;

const WORD = /\S+/g;

/** How many words a message holds: runs of anything but whitespace. */
export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/**
 * A message held to the limits: newlines become spaces (a bubble is one thought), then at most
 * AVATAR_SAY_MAX_WORDS words and AVATAR_SAY_MAX_CHARS characters. Spacing inside the kept text is left as typed,
 * so a draft clamped while typing keeps its trailing space.
 */
export function clampSayText(text: string): string {
  let out = text.replace(/[\r\n\t]+/g, ' ');
  if (countWords(out) > AVATAR_SAY_MAX_WORDS) {
    let seen = 0;
    let end = out.length;
    for (const m of out.matchAll(WORD)) {
      seen += 1;
      if (seen === AVATAR_SAY_MAX_WORDS) {
        end = m.index + m[0].length;
        break;
      }
    }
    out = out.slice(0, end);
  }
  return out.length > AVATAR_SAY_MAX_CHARS ? out.slice(0, AVATAR_SAY_MAX_CHARS) : out;
}

/** Whether a draft is within both limits as it stands. */
export function withinSayLimits(text: string): boolean {
  return text.length <= AVATAR_SAY_MAX_CHARS && countWords(text) <= AVATAR_SAY_MAX_WORDS;
}

const id = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= AVATAR_SAY_MAX_ID_LEN;

/**
 * The message an `avatar-say` op carries, trimmed and clamped, or null when the op is malformed: a missing or
 * over-long id, a text that is not a string, is blank, or is longer than AVATAR_SAY_MAX_CHARS, or a point that is
 * not finite. Too many words that fit the characters are clamped rather than refused.
 */
export function parseAvatarSay(op: unknown): AvatarSay | null {
  if (typeof op !== 'object' || op === null) return null;
  const o = op as Record<string, unknown>;
  if (!id(o.tabId) || !id(o.id)) return null;
  if (typeof o.text !== 'string' || o.text.length > AVATAR_SAY_MAX_CHARS) return null;
  const text = clampSayText(o.text).trim();
  if (!text) return null;
  if (typeof o.x !== 'number' || !Number.isFinite(o.x)) return null;
  if (typeof o.y !== 'number' || !Number.isFinite(o.y)) return null;
  return { tabId: o.tabId, id: o.id, text, x: o.x, y: o.y };
}
