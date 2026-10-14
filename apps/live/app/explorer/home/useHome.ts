'use client';

// Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md "useHome").
//
// One read draws the first screen (GET /api/home); this browser's own opens of its local documents
// are read beside it and placed by the same Within reach rule. A failed read is an error, never an empty Home: "we could not
// ask" and "there is nothing" are different answers (docs/specs/013-workspace/timeline.md §2.4).
// The read moves the Timeline's unread mark on the server, so a successful one clears the badge.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeGroup } from '@livediagram/api-schema';
import { apiReadHome } from '@/lib/api-client';
import { offlineListOpens, type LocalOpenDocument } from '@/lib/offline/offline-opens';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { jumpBackInSet, type JumpBackInSet } from './home-model';

export type HomeStatus = 'loading' | 'ready' | 'error';

export type HomeData = {
  status: HomeStatus;
  jumpBackIn: JumpBackInSet;
  whatHappened: HomeGroup[];
  /** The unread mark before this visit's first read; undefined when the person never looked. */
  lastSeenAt: number | undefined;
  retry: () => void;
};

type Loaded = { jumpBackIn: JumpBackInSet; whatHappened: HomeGroup[] };

const EMPTY: Loaded = { jumpBackIn: { mostUsed: [], recent: [] }, whatHappened: [] };

// The last successful read, one owner's only: a Home mounted again (the editor's Explorer, reopened) draws it at once
// and refreshes behind it, rather than flashing its skeleton and jumping as the cards arrive.
let lastRead: { ownerId: string; loaded: Loaded } | null = null;
const cachedFor = (ownerId: string | null): Loaded | null =>
  ownerId && lastRead?.ownerId === ownerId ? lastRead.loaded : null;

/** Test seam: forget the remembered read. */
export function forgetHomeRead(): void {
  lastRead = null;
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function localOpens(): Promise<LocalOpenDocument[]> {
  try {
    return await offlineListOpens();
  } catch (err) {
    console.warn('[home] local-opens-unavailable', err);
    return [];
  }
}

/** `onSeen` runs after each successful read: the server moved the unread mark. */
export function useHome(ownerId: string | null, onSeen: () => void): HomeData {
  const [status, setStatus] = useState<HomeStatus>(() =>
    cachedFor(ownerId) ? 'ready' : 'loading',
  );
  const [loaded, setLoaded] = useState<Loaded>(() => cachedFor(ownerId) ?? EMPTY);
  const [attempt, setAttempt] = useState(0);
  // From the first successful read only: that read moved the mark, so a later one reports nothing new.
  const [lastSeenAt, setLastSeenAt] = useState<{ at: number | undefined } | null>(null);
  const requestId = useRef(0);
  const onSeenRef = useLatest(onSeen);

  useEffect(() => {
    if (!ownerId) return;
    const id = ++requestId.current;
    let live = true;
    void Promise.all([apiReadHome(ownerId, { tz: browserTimeZone() }), localOpens()]).then(
      ([home, local]) => {
        if (!live || id !== requestId.current) return;
        if (!home) {
          setStatus('error');
          return;
        }
        const next = {
          jumpBackIn: jumpBackInSet(home.jumpBackIn, local, Date.now()),
          whatHappened: home.whatHappened,
        };
        lastRead = { ownerId, loaded: next };
        setLoaded(next);
        setStatus('ready');
        setLastSeenAt((held) => held ?? { at: home.lastSeenAt ?? undefined });
        onSeenRef.current();
      },
    );
    return () => {
      live = false;
    };
  }, [ownerId, attempt, onSeenRef]);

  const retry = useCallback(() => {
    track('Home', 'Loaded', 'Retry');
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return {
    status,
    jumpBackIn: loaded.jumpBackIn,
    whatHappened: loaded.whatHappened,
    lastSeenAt: lastSeenAt?.at,
    retry,
  };
}
