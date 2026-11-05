// Knocks that reached this browser (docs/specs/012-collaboration/knock.md): the room connection parses each op and
// hands it here; the canvas, which knows where your character stands, decides whether it is for you
// (useMeetingPieces). Nothing is kept: a knock nobody is listening for is dropped.
import {
  parseAvatarKnock,
  parseAvatarKnockAnswer,
  type AvatarKnockAnswerOp,
  type AvatarKnockOp,
} from '@livehuddle/api-schema';

export type KnockEvent =
  | { type: 'knock'; from: string; op: AvatarKnockOp }
  | { type: 'answer'; from: string; op: AvatarKnockAnswerOp };

const listeners = new Set<(event: KnockEvent) => void>();

export function onKnock(listener: (event: KnockEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** An `avatar-knock` or `avatar-knock-answer` from `from`; anything malformed is dropped. */
export function receiveKnockOp(from: string, raw: unknown): void {
  const knock = parseAvatarKnock(raw);
  const answer = knock ? null : parseAvatarKnockAnswer(raw);
  const event: KnockEvent | null = knock
    ? { type: 'knock', from, op: knock }
    : answer
      ? { type: 'answer', from, op: answer }
      : null;
  if (!event) return;
  for (const l of listeners) l(event);
}
