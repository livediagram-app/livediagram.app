// The facilitator baton (spec/147): who holds it, and who may move it.
//
// Pure decisions, no sockets and no storage, so every rule can be read (and
// tested) in one place while `diagram-room.ts` keeps the plumbing. The room is
// the only thing that can arbitrate this: it alone sees every socket, and it
// alone can mint a secret that reaches exactly one of them.
//
// The problem it solves: the room knows no identities. The upgrade forwards
// only `X-Verified-Role` (and now one `X-Verified-Owner` bit), presence ids are
// minted per socket, and the one client-claimed field is relayed unchanged
// because holding it grants nothing. So the baton cannot be pinned to a person.
// It is pinned to a TOKEN instead: the room mints one when it grants the baton
// and sends it to the holder alone, and a socket presenting that token IS the
// holder, whatever presence id it happens to be wearing today. A refresh keeps
// the baton; nobody else can take it, because nobody else was ever sent it.

/** How long a holder may be gone before the baton is released. */
export const FACILITATOR_GRACE_MS = 90_000;

export type FacilitatorState = {
  /** The holding session's presence id, or null when the baton is free. */
  holder: string | null;
  /** The secret only the holder has been sent. Null when the baton is free. */
  token: string | null;
  /** When the baton lapses, set while the holder is away. */
  graceUntil?: number;
};

export const FREE_BATON: FacilitatorState = { holder: null, token: null };

/** What the room knows about the session asking for something. */
export type Asker = {
  presenceId: string;
  role: 'edit' | 'view' | undefined;
  isOwner: boolean;
};

/** A move the room should make, or null when the ask is refused. */
export type BatonMove = {
  next: FacilitatorState;
  /** Presence id to send the fresh token to, when the holder changed. */
  tokenTo: string | null;
  reason: 'claim' | 'grant' | 'release';
};

// A view-role visitor cannot hold it: everything it governs writes to the
// document, so a baton they could not use would be a trap rather than a role.
const canHold = (asker: Pick<Asker, 'role'>) => asker.role === 'edit';

/**
 * Take a free baton — or, as the owner, take one somebody else is holding.
 *
 * That second row is the whole of "the diagram can always take back control",
 * and it is why the upgrade forwards an owner bit at all.
 */
export function claimBaton(state: FacilitatorState, asker: Asker, token: string): BatonMove | null {
  if (!canHold(asker)) return null;
  const free = state.holder === null;
  if (!free && !asker.isOwner) return null;
  if (state.holder === asker.presenceId) return null;
  return { next: { holder: asker.presenceId, token }, tokenTo: asker.presenceId, reason: 'claim' };
}

/**
 * Hand it to somebody else: the owner appointing, or the holder passing it on.
 * Anyone with edit rights may hand out a FREE baton, which is the same reach
 * they already have by taking it and stepping down.
 */
export function grantBaton(
  state: FacilitatorState,
  asker: Asker,
  target: Pick<Asker, 'presenceId' | 'role'> | null,
  token: string,
): BatonMove | null {
  if (!target || !canHold(target)) return null;
  if (target.presenceId === state.holder) return null;
  const mayMove = asker.isOwner || state.holder === asker.presenceId || state.holder === null;
  if (!mayMove || !canHold(asker)) return null;
  return {
    next: { holder: target.presenceId, token },
    tokenTo: target.presenceId,
    reason: 'grant',
  };
}

/** Step down. The owner may also end somebody else's turn. */
export function releaseBaton(state: FacilitatorState, asker: Asker): BatonMove | null {
  if (state.holder === null) return null;
  if (state.holder !== asker.presenceId && !asker.isOwner) return null;
  return { next: FREE_BATON, tokenTo: null, reason: 'release' };
}

/**
 * The baton coming home on a `hello` after a refresh.
 *
 * Accepted only while the room still holds the matching token, which stops the
 * moment anybody else is granted the baton (a new token is minted, so the old
 * one matches nothing). The presenter takes over whatever presence id they are
 * wearing now, and the grace deadline is cleared.
 */
export function reclaimBaton(
  state: FacilitatorState,
  asker: Asker,
  token: string | undefined,
): FacilitatorState | null {
  if (!token || !state.token || token !== state.token) return null;
  if (!canHold(asker)) return null;
  if (state.holder === asker.presenceId) return null;
  return { holder: asker.presenceId, token: state.token };
}

/** The holder's socket went away: start the clock rather than ending the turn. */
export function beginGrace(
  state: FacilitatorState,
  leaving: string,
  now: number,
): FacilitatorState | null {
  if (state.holder !== leaving) return null;
  return { ...state, graceUntil: now + FACILITATOR_GRACE_MS };
}

/**
 * Has an absent holder run out of time? The room asks this when its alarm
 * fires, and answers "no" if they reconnected in the meantime (a reclaim
 * clears the deadline).
 */
export function graceExpired(state: FacilitatorState, now: number): boolean {
  return state.holder !== null && state.graceUntil !== undefined && state.graceUntil <= now;
}

/**
 * May this session run the session tools? True for everybody while the baton
 * is free, which is what keeps every existing room behaving as it did.
 *
 * The room enforces this only for the ops it can see as session tools —
 * `poll-start` / `poll-end`, which are their own kinds. The timer and the vote
 * ride the same `tab` / `tab-meta` ops as every shape move, so they stay a
 * client-side rule; see spec/147 "How it is enforced, honestly".
 */
export function mayRunSession(state: FacilitatorState, presenceId: string): boolean {
  return state.holder === null || state.holder === presenceId;
}
