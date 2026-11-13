// The name a pinned note or a posted score carries is the sender's (docs/specs/009-elements/social-pieces.md "The
// author is the sender's", "Trust"): the room writes it from the name on the sender's presence, the one their cursor
// and character carry, so nobody pins or posts under a colleague's name whatever the frame claimed. Run by the room
// on every `el-delta` it sequences, after `stampCommentAuthor`.

import { cutText } from '@liveworkspace/model-core/text-cut';
import { arcadeName } from './arcade-scores';
import { NOTE_AUTHOR_MAX } from './office-social';

/** A note's author with no name to give: the editor's own fallback (useNoteSigner). */
export const NOTE_AUTHOR_FALLBACK = 'Someone';

/** The author a note from a sender showing `name` carries: the name cut to fit, or "Someone". */
export function noteAuthorName(name: string): string {
  const cut = cutText(name.trim(), NOTE_AUTHOR_MAX).trim();
  return cut.length > 0 ? cut : NOTE_AUTHOR_FALLBACK;
}

/**
 * The op with a `notice-pin`'s author and an `arcade-score`'s name set from the sender's presence name. Anything else
 * (and a pin or score that is not an object, which the delta's own check refuses) comes back the same object.
 */
export function stampSenderName(op: unknown, name: string): unknown {
  const o = op as { kind?: unknown; delta?: { kind?: unknown; note?: unknown; score?: unknown } };
  if (o?.kind !== 'el-delta' || typeof o.delta !== 'object' || o.delta === null) return op;
  const d = o.delta;
  if (d.kind === 'notice-pin' && typeof d.note === 'object' && d.note !== null) {
    return { ...o, delta: { ...d, note: { ...d.note, author: noteAuthorName(name) } } };
  }
  if (d.kind === 'arcade-score' && typeof d.score === 'object' && d.score !== null) {
    return { ...o, delta: { ...d, score: { ...d.score, name: arcadeName(name) } } };
  }
  return op;
}
