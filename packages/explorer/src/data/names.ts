'use client';

// Who did what, by name (What Happened, the Timeline): the index keeps only an event's actor id, so the names come
// from the Explorer's one people store (usePeople.ts), the same that names the Owner column: gathered into one
// request per beat, at most PEOPLE_MAX ids each, and kept for the page, bounded. No request per row, none twice.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { TimelineEvent } from '@liveworkspace/index-client';
import { useExtras } from '../explorer/extras';

/** The events with their actors' names filled in where the event carries none, asking for the missing ones. */
export function useNamedEvents<E extends Pick<TimelineEvent, 'actorId' | 'actorName'>>(
  events: readonly E[],
): readonly E[] {
  const { people } = useExtras();
  const version = useSyncExternalStore(people.subscribe, people.version, people.version);
  useEffect(() => {
    const ids = events.flatMap((e) =>
      !e.actorName && e.actorId && e.actorId !== 'deleted' ? [e.actorId] : [],
    );
    if (ids.length) people.want(ids);
  }, [people, events]);
  return useMemo(
    () =>
      events.map((e) => {
        if (e.actorName || !e.actorId) return e;
        const actorName = people.name(e.actorId);
        return actorName ? { ...e, actorName } : e;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is what changes people.name
    [events, people, version],
  );
}
