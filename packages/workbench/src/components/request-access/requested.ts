// Request Access, the requester's memory (liveworkspace/docs/specs/004-index/request-access.md "On screen"): which
// items this browser tab asked about, so the Not Found card and every live embed of an item agree on Requested and
// none asks twice. Module state, gone with the page: the index has no read of a person's requests, by design, and
// asking again within its week records nothing new. Also the one place a press reaches the index, and the words
// for how it went.
import { IndexError } from '@liveworkspace/index-client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { indexClient } from '../../lib/index-client';

const asked = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marks an item asked about in this tab, and tells every control showing it. */
export function markRequested(itemId: string) {
  if (asked.has(itemId)) return;
  asked.add(itemId);
  for (const l of listeners) l();
}

/** For tests: forget every ask. */
export function forgetRequested() {
  asked.clear();
  for (const l of listeners) l();
}

/** Whether this tab asked about the item. */
export function useRequested(itemId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => asked.has(itemId),
    () => false,
  );
}

/** Why a press failed, as the control says it. */
export type RequestFailure = 'busy' | 'signed-out' | 'other';

export const REQUEST_FAILURE_TEXT: Record<RequestFailure, string> = {
  busy: 'You’ve asked for access a lot today. Try again later.',
  'signed-out': 'Sign in to ask for access.',
  other: 'Couldn’t send your request. Try again.',
};

export const REQUESTED_LINE = 'If its owner shares it with you, you’ll get an email.';

/** How one ask is made: the index's route by default (one POST, the same answer for every id). */
export type AskForAccess = (itemId: string, note: string | null) => Promise<unknown>;

export const askIndex: AskForAccess = (itemId, note) =>
  indexClient.requestAccess(itemId, note ? { note } : {});

const failureOf = (e: unknown): RequestFailure =>
  e instanceof IndexError
    ? e.status === 429
      ? 'busy'
      : e.status === 401
        ? 'signed-out'
        : 'other'
    : 'other';

/** One item's ask: whether it is out, how the last one failed, and the press itself (one at a time, never twice
 *  once it went). */
export function useAskForAccess(itemId: string, ask: AskForAccess = askIndex) {
  const requested = useRequested(itemId);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<RequestFailure | null>(null);
  const send = useCallback(
    async (note: string | null) => {
      if (sending || asked.has(itemId)) return;
      setSending(true);
      setFailed(null);
      try {
        await ask(itemId, note?.trim() || null);
        markRequested(itemId);
      } catch (e) {
        setFailed(failureOf(e));
      } finally {
        setSending(false);
      }
    },
    [ask, itemId, sending],
  );
  return { requested, sending, failed, send };
}
