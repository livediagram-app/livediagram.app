'use client';

// Other people's display names for the Owner column and the owner line, and their Google pictures for the avatars
// (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): asked for as rows come on screen, gathered into one request a
// beat later (never one per row or per avatar), and kept for the page, bounded. A name and a picture come in the same
// answer. Without an accounts reader every name is unknown and the rows say who in other words ("Shared with you"),
// and every avatar shows initials.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { PEOPLE_MAX, type ExplorerAccounts, type ExplorerPerson } from './accounts';

export type PeopleStore = {
  /** A name: a string, null for a person with none, undefined while unknown. */
  name: (id: string) => string | null | undefined;
  /** A picture: a URL, null for a person with none, undefined while unknown. */
  picture: (id: string) => string | null | undefined;
  /** Asks for these people's names (those not yet known or asked for). */
  want: (ids: readonly string[]) => void;
  subscribe: (listener: () => void) => () => void;
  version: () => number;
};

// Names kept for the page: past this many the oldest are let go.
export const PEOPLE_CACHE_MAX = 2000;
// How long asks are gathered before one request goes.
const GATHER_MS = 30;
// A failed request is asked again on its own after these waits (a row that stays on screen never asks twice), then
// the ids are let go for the next ask.
export const PEOPLE_RETRY_MS = [2000, 8000] as const;

export function createPeopleStore(accounts: ExplorerAccounts | null): PeopleStore {
  const known = new Map<string, ExplorerPerson | null>();
  const asked = new Set<string>();
  // Failed tries so far per id, while a retry is due: dropped on an answer or when the retries run out.
  const failures = new Map<string, number>();
  let queue = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let version = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    version++;
    for (const l of listeners) l();
  };
  const flush = () => {
    timer = null;
    const ids = [...queue];
    queue = new Set();
    for (let i = 0; i < ids.length; i += PEOPLE_MAX) {
      const batch = ids.slice(i, i + PEOPLE_MAX);
      accounts!.people(batch).then(
        (people) => {
          for (const id of batch) {
            failures.delete(id);
            known.set(id, people.get(id) ?? null);
            if (known.size > PEOPLE_CACHE_MAX) {
              const oldest = known.keys().next().value as string;
              known.delete(oldest);
              asked.delete(oldest);
            }
          }
          notify();
        },
        // Unknown stays unknown for now: asked again after a wait, as the row that asked may stay mounted and never
        // ask again; once the retries run out a later ask may try again.
        () => {
          // A batch can mix ids on different tries (a retry gathers with fresh asks): one timer per wait.
          const due = new Map<number, string[]>();
          for (const id of batch) {
            const tries = (failures.get(id) ?? 0) + 1;
            const wait = PEOPLE_RETRY_MS[tries - 1];
            if (wait === undefined) {
              failures.delete(id);
              asked.delete(id);
              continue;
            }
            failures.set(id, tries);
            const group = due.get(wait);
            if (group) group.push(id);
            else due.set(wait, [id]);
          }
          for (const [wait, ids] of due) {
            setTimeout(() => {
              for (const id of ids) asked.delete(id);
              want(ids);
            }, wait);
          }
        },
      );
    }
  };
  const want = (ids: readonly string[]) => {
    if (!accounts) return;
    for (const id of ids) {
      if (asked.has(id)) continue;
      asked.add(id);
      queue.add(id);
    }
    if (queue.size > 0 && timer === null) timer = setTimeout(flush, GATHER_MS);
  };
  return {
    name: (id) => (known.has(id) ? (known.get(id)?.name ?? null) : undefined),
    picture: (id) => (known.has(id) ? (known.get(id)?.picture ?? null) : undefined),
    want,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

/** The store for this accounts reader, made once per reader. */
export function usePeopleStore(accounts: ExplorerAccounts | null): PeopleStore {
  return useMemo(() => createPeopleStore(accounts), [accounts]);
}

/** A person's Google picture, asked for on first sight with their name (the same batched request); re-renders when it
 *  arrives. Null with none, or for no one. */
export function usePersonPicture(store: PeopleStore, id: string | null | undefined): string | null {
  useSyncExternalStore(store.subscribe, store.version, store.version);
  useEffect(() => {
    if (id) store.want([id]);
  }, [store, id]);
  return id ? (store.picture(id) ?? null) : null;
}

/** A person's name, asked for on first sight; re-renders when it arrives. */
export function usePersonName(store: PeopleStore, id: string | null): string | null | undefined {
  useSyncExternalStore(store.subscribe, store.version, store.version);
  useEffect(() => {
    if (id) store.want([id]);
  }, [store, id]);
  return id ? store.name(id) : undefined;
}
