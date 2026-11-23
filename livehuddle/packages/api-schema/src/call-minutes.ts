// Call Minutes on the wire (docs/specs/012-collaboration/call-minutes.md "The wire"): what the mint route, the minutes
// read and the room tell a browser about the Space's owner's month of calls. Every number is one the server decided;
// a browser sends none of this, and nothing here exists with Pro off.

/** From this many minutes left, the room says the month is running low, once. */
export const CALL_MINUTES_LOW = 80;

/**
 * Whose month the Space's calls count against, as the caller may know it (liveworkspace 019 "What a collaborator is
 * told"). `owner`: the Space's owner (`p:<accountId>` or `t:<teamId>`), sent to a signed-in caller alone, who asks
 * the subscription service which action they may take. `guest`: the Space's owner has no account, so the room counts
 * Free's month for the Space itself, there is no owner to name and nobody to offer an upgrade.
 */
export type CallMinutesWho = { owner?: string; guest?: true };

/** On a metered session's answer: whose month, and whether it runs low. */
export type CallSessionMinutes = CallMinutesWho & { low: boolean };

/** `429 calls_minutes_used`: the owner's month is used. The numbers are for the owner and the owning team alone. */
export type CallMinutesRefusal = CallMinutesWho & {
  error: 'calls_minutes_used';
  used?: number;
  limit?: number;
};

/**
 * GET /api/documents/:id/calls/minutes. `used` and `limit` are numbers for the owner and the owning team's members
 * alone; null for anyone else, and `used` also while the room has spent nothing this month. `paused` says the month
 * is used, to everyone.
 */
export type CallMinutesResponse =
  | { metered: false }
  | {
      metered: true;
      owner?: string;
      guest?: true;
      used: number | null;
      limit: number | null;
      low: boolean;
      paused: boolean;
    };

export const CALL_MINUTES_STATES = ['low', 'used', 'ok'] as const;
export type CallMinutesState = (typeof CALL_MINUTES_STATES)[number];

/**
 * The room's word on the owner's call minutes: running low, used (every call ends), or calls may start again. The
 * state alone: it goes to every connection, a signed-out visitor's included, so it names no owner and no number.
 * Whoever may know more reads it from the minutes route.
 */
export type CallMinutesOp = {
  kind: 'call-minutes';
  state: CallMinutesState;
};

/** A `call-minutes` op as the room sent it, or null. Anything beside its state is dropped. */
export function parseCallMinutesOp(op: unknown): CallMinutesOp | null {
  const o = op as Partial<Record<keyof CallMinutesOp, unknown>> | null;
  if (!o || o.kind !== 'call-minutes') return null;
  if (!(CALL_MINUTES_STATES as readonly unknown[]).includes(o.state)) return null;
  return { kind: 'call-minutes', state: o.state as CallMinutesState };
}
