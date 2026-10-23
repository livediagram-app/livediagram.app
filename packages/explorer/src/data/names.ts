'use client';

// Who did what, by name: the index keeps only an event's actor id, so What Happened and the Timeline ask the host
// for names (on liveworkspace.app, the accounts' profiles). Every id the screen needs is gathered into one batch per
// tick, at most NAME_BATCH ids a request, and each answer is kept for the page's life: no request per row, and none
// again for a name already asked.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { TimelineEvent } from '@liveworkspace/index-client';

/** The host's names for actor ids: any it does not know are simply left out. */
export type NameLookup = (ids: readonly string[]) => Promise<Record<string, string | null>>;

export const NAME_BATCH = 100;
// Names kept at most; past it the oldest go (a page open all day still stays small).
const NAME_CAP = 2000;

export type NameStore = {
  want: (ids: Iterable<string | null | undefined>) => void;
  name: (id: string | null | undefined) => string | null;
  subscribe: (listener: () => void) => () => void;
  version: () => number;
};

export function createNameStore(lookup: NameLookup | undefined): NameStore {
  const names = new Map<string, string | null>();
  const asked = new Set<string>();
  let queue: string[] = [];
  let scheduled = false;
  let version = 0;
  const listeners = new Set<() => void>();

  const flush = () => {
    scheduled = false;
    const ids = queue;
    queue = [];
    for (let i = 0; i < ids.length; i += NAME_BATCH) {
      const chunk = ids.slice(i, i + NAME_BATCH);
      lookup!(chunk).then(
        (found) => {
          for (const id of chunk) {
            asked.delete(id);
            names.set(id, found[id]?.trim() || null);
          }
          while (names.size > NAME_CAP) names.delete(names.keys().next().value!);
          version++;
          for (const listener of listeners) listener();
        },
        // Failed: asked again the next time a screen wants them.
        () => {
          for (const id of chunk) asked.delete(id);
        },
      );
    }
  };

  return {
    want(ids) {
      if (!lookup) return;
      for (const id of ids) {
        if (!id || id === 'deleted' || names.has(id) || asked.has(id)) continue;
        asked.add(id);
        queue.push(id);
      }
      if (queue.length && !scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
    name: (id) => (id ? (names.get(id) ?? null) : null),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

const NO_NAMES = createNameStore(undefined);
const Ctx = createContext<NameStore>(NO_NAMES);
export const NamesProvider = Ctx.Provider;

/** The events with their actors' names filled in where the event carries none, asking for the missing ones. */
export function useNamedEvents<E extends Pick<TimelineEvent, 'actorId' | 'actorName'>>(
  events: readonly E[],
): readonly E[] {
  const names = useContext(Ctx);
  const version = useSyncExternalStore(names.subscribe, names.version, names.version);
  useEffect(() => {
    names.want(events.filter((e) => !e.actorName).map((e) => e.actorId));
  }, [names, events]);
  return useMemo(
    () =>
      events.map((e) => {
        if (e.actorName) return e;
        const actorName = names.name(e.actorId);
        return actorName ? { ...e, actorName } : e;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is what changes names.name
    [events, names, version],
  );
}
