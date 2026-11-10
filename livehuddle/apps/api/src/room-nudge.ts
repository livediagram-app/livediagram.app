// The room's half of a nudge (docs/specs/012-collaboration/nudge.md "The wire"; blueprint blueprints/nudge.md): who
// the sender and the target are for the 2 minute ledger, and what to do with one nudge. Pure, so every rule is tested
// without a socket; the room acts on the answer.
import { createNudgeLedger, type NudgeOp } from '@livehuddle/api-schema';
import type { SessionAttachment } from './room-session';

type NudgeLedger = ReturnType<typeof createNudgeLedger>;

/**
 * A session's identity for the ledger, steadiest first: a verified account's person tag (it cannot be rotated), else
 * the collab key pinned on its session (stable per person), else its presence id (per socket).
 */
export function nudgeIdentity(
  session: Pick<SessionAttachment, 'personTag' | 'presence'>,
): string | null {
  if (session.personTag) return `p:${session.personTag}`;
  const presence = session.presence;
  if (!presence) return null;
  return presence.key ? `k:${presence.key}` : `s:${presence.id}`;
}

export type NudgeDecision =
  | { kind: 'deliver' }
  | { kind: 'refuse'; retryInMs: number }
  /** Not answered: to yourself, to nobody in the room, or from a session the room cannot place. */
  | { kind: 'drop'; reason: 'self' | 'absent' | 'unknown' };

export function decideNudge(input: {
  op: NudgeOp;
  sender: Pick<SessionAttachment, 'personTag' | 'presence'>;
  /** The session holding `op.targetId`, or null when nobody in the room does. */
  target: Pick<SessionAttachment, 'personTag' | 'presence'> | null;
  ledger: NudgeLedger;
  now: number;
}): NudgeDecision {
  const { op, sender, target, ledger, now } = input;
  if (sender.presence?.id === op.targetId) return { kind: 'drop', reason: 'self' };
  if (!target) return { kind: 'drop', reason: 'absent' };
  const from = nudgeIdentity(sender);
  const to = nudgeIdentity(target);
  if (!from || !to) return { kind: 'drop', reason: 'unknown' };
  // Your other tab is still you.
  if (from === to) return { kind: 'drop', reason: 'self' };
  const check = ledger.check(from, to, now);
  return check.ok ? { kind: 'deliver' } : { kind: 'refuse', retryInMs: check.retryInMs };
}
