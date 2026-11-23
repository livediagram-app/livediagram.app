// The Space's owner's call minutes as this browser knows them (docs/specs/012-collaboration/call-minutes.md "What
// people see"): whose month the calls count against, whether it is running low, and whether it is used. Told by the
// mint route (a session's answer, a refused join) and the room's own `call-minutes` op, never worked out here. A
// module store, like the calls' (calls-store.ts), so the call, the dock and the notices share it. With Pro off the
// server says none of it, and this stays empty.
import { useSyncExternalStore } from 'react';
import { parseCallMinutesOp, type CallSessionMinutes } from '@livehuddle/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import type { CallMinutesUsed, CallsCaller } from '@/lib/api/calls';

export type CallMinutes = {
  /** Who asks the api about this Space (the call's own caller), for the notices' reads. */
  caller: CallsCaller | null;
  /** The server has said the Space's calls are counted (a session's answer, a refusal, the room's word). */
  metered: boolean;
  /** The Space's owner (`p:<accountId>` or `t:<teamId>`), as the server names them to someone signed in; null for a
   *  signed-out visitor, for a guest's Space, and until the server has said. */
  owner: string | null;
  /** The Space's owner has no account: nobody is offered an upgrade, and the notice says to sign in. */
  guest: boolean;
  /** The month is running low (80 minutes left or fewer). */
  low: boolean;
  /** The month is used: calls are paused. Its numbers where the server gave them (the owner's and the owning
   *  team's to see), else null each. Null while minutes are left. */
  used: { used: number | null; limit: number | null } | null;
  /** The used-up dialog is open. */
  notice: boolean;
};

const NONE: CallMinutes = {
  caller: null,
  metered: false,
  owner: null,
  guest: false,
  low: false,
  used: null,
  notice: false,
};

let state: CallMinutes = NONE;
const listeners = createListeners();
const usedListeners = createListeners();
const resumedListeners = createListeners();

function set(patch: Partial<CallMinutes>): void {
  const next = { ...state, ...patch };
  const same = (Object.keys(next) as (keyof CallMinutes)[]).every((k) => next[k] === state[k]);
  if (same) return;
  state = next;
  listeners.notify();
}

export function callMinutes(): CallMinutes {
  return state;
}

export function useCallMinutes(): CallMinutes {
  return useSyncExternalStore(listeners.subscribe, callMinutes, callMinutes);
}

/** A session's answer: metered (whose month, and whether it runs low), or not (an api with Pro off says nothing). */
export function noteCallSessionMinutes(
  minutes: CallSessionMinutes | undefined,
  caller: CallsCaller,
): void {
  if (!minutes) return;
  // A session was minted, so the month is not used (any more): the dock and the dialog go back to the call.
  set({
    caller,
    metered: true,
    owner: minutes.owner ?? null,
    guest: minutes.guest === true,
    low: minutes.low,
    used: null,
    notice: false,
  });
}

/**
 * The owner's month is used: a refused join, or the room's word. `ended`: a call was running, so the dialog opens to
 * say why it stopped; a join refused on arriving only pauses the dock.
 */
export function noteCallMinutesUsed(
  told: CallMinutesUsed,
  ended: boolean,
  caller: CallsCaller | null = state.caller,
): void {
  const fresh = state.used === null;
  const before = state.used;
  set({
    caller,
    metered: true,
    owner: told.owner ?? state.owner,
    guest: told.guest || state.guest,
    low: false,
    // Numbers already known are kept where this word brings none (the room's op never does).
    used:
      before && told.used === null && before.used !== null
        ? before
        : { used: told.used, limit: told.limit },
    ...(ended && fresh ? { notice: true } : {}),
  });
  if (fresh) usedListeners.notify();
}

/** The room's `call-minutes` op; anything else, or from anyone but the room, is ignored. */
export function receiveCallMinutes(from: string, op: unknown, inCall: boolean): void {
  const told = from === 'system' ? parseCallMinutesOp(op) : null;
  if (!told) return;
  // The op is the state alone (it goes to everyone in the Space): whose month it is and its numbers are what the
  // api told this person, or tells them when a notice asks.
  if (told.state === 'low') {
    set({ metered: true, low: true });
  } else if (told.state === 'used') {
    noteCallMinutesUsed(
      { owner: state.owner, guest: state.guest, used: null, limit: null },
      inCall,
    );
  } else {
    const paused = state.used !== null;
    set({ low: false, used: null, notice: false });
    if (paused) resumedListeners.notify();
  }
}

/** Subscribe to the month becoming used (the running call ends as Leave does). */
export function onCallMinutesUsed(listener: () => void): () => void {
  return usedListeners.subscribe(listener);
}

/** Subscribe to calls starting again (the canvas joins again by itself). */
export function onCallMinutesResumed(listener: () => void): () => void {
  return resumedListeners.subscribe(listener);
}

/** Open or close the used-up dialog (the dock's Calls Paused opens it; Back to the Space closes it). */
export function setCallMinutesNotice(open: boolean): void {
  if (open && state.used === null) return;
  set({ notice: open });
}

/** The low notice was closed, or the page learned the month is no longer low. */
export function clearCallMinutesLow(): void {
  set({ low: false });
}

/** Back to knowing nothing (leaving the Space). */
export function resetCallMinutes(): void {
  state = NONE;
  listeners.notify();
}
