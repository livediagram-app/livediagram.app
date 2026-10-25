// Who follows whom in a room (each product's docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"). Each session's
// `follow` op names the presence id it follows; the room keeps that on the session and tells each person, on their
// own socket, who follows them. Pure, so the rules are tested apart from the Durable Object.

// The longest presence id a follow may name: the room mints them as UUIDs (36 characters).
export const MAX_FOLLOW_TARGET_LEN = 36;

/** The target a `follow` op names, or null to stop: a non-empty string that is not the sender, clamped. */
export function followTargetOf(op: unknown, selfId: string): string | null {
  const raw = (op as { target?: unknown } | null)?.target;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_FOLLOW_TARGET_LEN)
    return null;
  return raw === selfId ? null : raw;
}

/** The presence ids of the sessions following `target`, in a stable order. */
export function followerIdsOf(
  sessions: readonly { presenceId: string | undefined; following?: string | null }[],
  target: string,
): string[] {
  return sessions
    .filter((s) => s.presenceId !== undefined && s.following === target)
    .map((s) => s.presenceId!)
    .sort();
}
