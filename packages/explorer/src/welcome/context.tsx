'use client';

// Whether Home is a first run (livediagram's useFirstRun, read from the index): one request for a single item the
// person can open (the index's `search` view, which spans their own, their teams' and what is shared with them),
// in this app or, under All, any, and only while Home shows and the host has a welcome. A failed read says nothing,
// so it is never taken for an empty account.
//
// The answer takes a moment and the hero's words depend on it, so until it lands the hero draws what this browser
// last saw for this person (new when it has never seen them): no flash of the wrong greeting.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAbort } from '../data/errors';
import { readAnyItem } from '../data/homeReads';
import { useExplorer } from '../explorer/context';
import { useThisBrowserItems } from '../explorer/ThisBrowser';
import type { WelcomeOptions } from './types';

const SEEN_KEY = 'liveworkspace:explorer-has-items';

type Seen = { viewer: string; scope: string; has: boolean };

function remembered(viewer: string | null, scope: string): boolean | undefined {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as Seen | null;
    if (!seen || typeof seen.has !== 'boolean') return undefined;
    return seen.viewer === (viewer ?? '') && seen.scope === scope ? seen.has : undefined;
  } catch {
    return undefined;
  }
}

function remember(viewer: string | null, scope: string, has: boolean) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ viewer: viewer ?? '', scope, has }));
  } catch {
    // A private window: the hero simply guesses again next time.
  }
}

export type FirstRun = {
  /** The answer, once read: the body shows the welcome. */
  firstRun: boolean;
  /** What the hero draws meanwhile: the answer, or this browser's last one. */
  heroFirstRun: boolean;
  welcome: WelcomeOptions | null;
};

const NONE: FirstRun = { firstRun: false, heroFirstRun: false, welcome: null };
const Ctx = createContext<FirstRun>(NONE);

export function useFirstRun(): FirstRun {
  return useContext(Ctx);
}

export function WelcomeProvider({
  welcome,
  active,
  children,
}: {
  welcome: WelcomeOptions | undefined;
  /** Home is showing: the only time the question is asked. */
  active: boolean;
  children: ReactNode;
}) {
  const { client, app, filter, epoch, viewerId } = useExplorer();
  const scope = `${filter === 'all' ? 'all' : app}`;
  const key = `${viewerId ?? ''}:${scope}:${epoch}`;
  const [answer, setAnswer] = useState<{ key: string; empty: boolean } | null>(null);
  const enabled = Boolean(welcome) && active;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // Answered by the index beside Jump Back In's read when Home asks both at once (homeReads.ts).
    readAnyItem(client, app, filter, controller.signal)
      .then((found) => {
        const empty = !found;
        remember(viewerId, scope, !empty);
        setAnswer({ key, empty });
      })
      .catch((e: unknown) => {
        // Failed: not a first run, and the last answer stands.
        if (!isAbort(e)) setAnswer({ key, empty: false });
      });
    return () => controller.abort();
  }, [enabled, client, app, filter, viewerId, scope, key]);

  // Something kept only in this browser (the host's This Browser) is not a first run either.
  const { live: local } = useThisBrowserItems();
  const keptHere = local.length > 0;
  const known = answer?.key === key ? answer.empty : undefined;
  const firstRun = enabled && !keptHere && known === true;
  const heroFirstRun = enabled && !keptHere && (known ?? remembered(viewerId, scope) !== true);

  const onFirstRun = welcome?.onFirstRun;
  useEffect(() => {
    if (heroFirstRun) onFirstRun?.();
  }, [heroFirstRun, onFirstRun]);

  const value = useMemo<FirstRun>(
    () => (welcome ? { firstRun, heroFirstRun, welcome } : NONE),
    [welcome, firstRun, heroFirstRun],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
