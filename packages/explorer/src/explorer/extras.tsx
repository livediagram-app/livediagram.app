'use client';

// What the Explorer page knows beyond the index: people from liveworkspace accounts (the Owner column's names; teams
// are teams/context.tsx's), whether the person is signed in (a
// guest is nudged to sign in for Teams), the host's preview prefetch and view-toggle telemetry, and the rows
// sliding out as they are deleted. Kept beside the core context so a surface without it (the editor's panel)
// reads quiet defaults.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { ExplorerAccounts } from '../data/accounts';
import { usePeopleStore, type PeopleStore } from '../data/usePeople';
import { useSharedCount } from '../data/useSharedCount';
import { useOptionalExplorer } from './context';

export type ViewModeTelemetry = 'ExplorerViewList' | 'ExplorerViewCard' | 'ExplorerViewDetails';

export type ExplorerExtras = {
  accounts: ExplorerAccounts | null;
  people: PeopleStore;
  // A guest sees the Sign in to access Teams nudge.
  signedIn: boolean;
  signInHref?: string;
  // The host loads an item's preview ahead, as its Details row comes near the screen.
  prefetchThumbnail?: (item: Item) => void;
  // A real switch of the List / Card / Details toggle (`UI / Toggled / <type>`).
  onViewToggled?: (type: ViewModeTelemetry) => void;
  // Shared With Me's count, for its sidebar row.
  sharedCount: number | string | undefined;
  // Rows playing their exit as they are deleted.
  leaving: ReadonlySet<string>;
  // Plays a row's exit, then runs the change (at once under reduced motion).
  slideOut: (id: string, run: () => void) => void;
};

export type ExtrasProps = {
  accounts?: ExplorerAccounts | null;
  signedIn?: boolean;
  signInHref?: string;
  prefetchThumbnail?: (item: Item) => void;
  onViewToggled?: (type: ViewModeTelemetry) => void;
};

// The exit's length (the row's slide-row-out).
export const SLIDE_OUT_MS = 160;

// Items whose snapshot was asked for, kept for the page; past this the record starts again.
const PREFETCHED_MAX = 5000;

const Ctx = createContext<ExplorerExtras | null>(null);

const NO_LEAVING: ReadonlySet<string> = new Set();

const QUIET: ExplorerExtras = {
  accounts: null,
  people: {
    name: () => undefined,
    picture: () => undefined,
    want: () => {},
    subscribe: () => () => {},
    version: () => 0,
  },
  signedIn: true,
  sharedCount: undefined,
  leaving: NO_LEAVING,
  slideOut: (_id, run) => run(),
};

export function useExtras(): ExplorerExtras {
  return useContext(Ctx) ?? QUIET;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function ExtrasProvider({
  accounts = null,
  signedIn = true,
  signInHref,
  prefetchThumbnail,
  onViewToggled,
  children,
}: ExtrasProps & { children: ReactNode }) {
  const core = useOptionalExplorer();
  const people = usePeopleStore(accounts);
  const sharedCount = useSharedCount(core!.client, core!.app, core!.filter, core!.epoch);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(NO_LEAVING);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const slideOut = useCallback((id: string, run: () => void) => {
    if (reducedMotion()) {
      run();
      return;
    }
    setLeaving((now) => new Set(now).add(id));
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        run();
        setLeaving((now) => {
          const next = new Set(now);
          next.delete(id);
          return next;
        });
      }, SLIDE_OUT_MS),
    );
  }, []);
  // Each item's snapshot is asked for once per page, however often its row scrolls back into view (bounded).
  const prefetched = useRef(new Set<string>());
  const prefetchOnce = useMemo(() => {
    if (!prefetchThumbnail) return undefined;
    return (item: Item) => {
      const seen = prefetched.current;
      if (seen.has(item.id)) return;
      if (seen.size >= PREFETCHED_MAX) seen.clear();
      seen.add(item.id);
      prefetchThumbnail(item);
    };
  }, [prefetchThumbnail]);
  const value = useMemo<ExplorerExtras>(
    () => ({
      accounts,
      people,
      signedIn,
      signInHref,
      prefetchThumbnail: prefetchOnce,
      onViewToggled,
      sharedCount,
      leaving,
      slideOut,
    }),
    [
      accounts,
      people,
      signedIn,
      signInHref,
      prefetchOnce,
      onViewToggled,
      sharedCount,
      leaving,
      slideOut,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
