'use client';

// What a tab window on the canvas reads (docs/specs/009-elements/tab-window.md): the document's tabs, where each
// one's content is, and the few things a window does (ask for its tab, open it, show another). Provided once by the
// canvas host rather than threaded through every element.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';

// A fetch of the tab already under way elsewhere (the visit-time load, the side pane, an export) answers a window's
// ask at once without the tab; the window asks again after this long, so it learns how that fetch ended (loaded, or
// failed with a Retry) rather than showing Loading for ever.
export const TAB_WINDOW_REASK_MS = 1_500;

export type TabWindowStatus = 'loaded' | 'loading' | 'failed';

export type TabWindowContextValue = {
  // The document's tabs this person sees, in tab-bar order, and the tab the canvas is on.
  tabs: readonly Tab[];
  ownTabId: string;
  // Where a tab's content is (per-tab storage: it arrives only when opened or fetched).
  status: (tabId: string) => TabWindowStatus;
  // Ask for a tab's content (a window showing it); a fetch already under way or done is left alone.
  request: (tabId: string) => void;
  // Fetch a failed tab again; the window shows Loading until it settles.
  retry: (tabId: string) => void;
  // Go to the tab (everyone's who can see it).
  open: (tabId: string) => void;
  // Show another tab in a window (an Editor's); absent for anyone else.
  choose?: (elementId: string, tabId: string) => void;
};

export const TabWindowContext = createContext<TabWindowContextValue | null>(null);

/** The windows' context, or null where nothing provides it (a renderer outside the editor). */
export function useTabWindows(): TabWindowContextValue | null {
  return useContext(TabWindowContext);
}

/** The value the canvas host provides, from the editor's tabs and its per-tab loading. */
export function useTabWindowContextValue({
  tabs,
  ownTabId,
  loadedTabIds,
  loadTabs,
  openTab,
  canChoose,
  commitElements,
  isOutOfScope,
  loadErrors,
}: {
  tabs: readonly Tab[];
  ownTabId: string;
  loadedTabIds: ReadonlySet<string>;
  // The editor's fetch of the named tabs' content; resolves to the ones that failed.
  loadTabs: (only: readonly string[]) => Promise<string[]>;
  openTab: (tabId: string) => void;
  // The session may edit the tab (`can.level === 'edit'`, the tab unlocked).
  canChoose: boolean;
  commitElements: (map: (els: Tab['elements']) => Tab['elements']) => void;
  // A tab outside this session's tab-scoped share link (docs/specs/013-workspace/tab-scoped-share-links.md): left out
  // of the windows' tabs, so a window onto one is unavailable (no name, no endless Loading) and the list never
  // offers it.
  isOutOfScope?: (tabId: string) => boolean;
  // The tabs the editor's own visit-time load failed on.
  loadErrors?: ReadonlySet<string>;
}): TabWindowContextValue {
  const shownTabs = useMemo(
    () => (isOutOfScope ? tabs.filter((t) => !isOutOfScope(t.id)) : tabs),
    [tabs, isOutOfScope],
  );
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // The tabs asked for and not yet settled, so many windows onto one tab ask once.
  const asked = useRef(new Set<string>());
  const loaded = useLatest(loadedTabIds);
  const reasks = useRef(new Set<ReturnType<typeof setTimeout>>());
  // The fetch below, for its own re-ask (a callback cannot name itself).
  const askAgain = useRef<(tabId: string) => void>(() => {});
  useEffect(() => {
    const timers = reasks.current;
    return () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);
  const fetchTab = useCallback(
    (tabId: string) => {
      if (asked.current.has(tabId)) return;
      asked.current.add(tabId);
      void loadTabs([tabId]).then((failures) => {
        asked.current.delete(tabId);
        // Neither loaded nor failed: the fetch was another caller's, still under way. Ask again shortly.
        if (!failures.includes(tabId) && !loaded.current.has(tabId)) {
          const t = setTimeout(() => {
            reasks.current.delete(t);
            if (!loaded.current.has(tabId)) askAgain.current(tabId);
          }, TAB_WINDOW_REASK_MS);
          reasks.current.add(t);
        }
        setFailed((prev) => {
          const was = prev.has(tabId);
          const now = failures.includes(tabId);
          if (was === now) return prev;
          const next = new Set(prev);
          if (now) next.add(tabId);
          else next.delete(tabId);
          return next;
        });
      });
    },
    [loadTabs, loaded],
  );
  useAssignRef(askAgain, fetchTab);
  const status = useCallback(
    (tabId: string): TabWindowStatus =>
      tabId === ownTabId || loadedTabIds.has(tabId)
        ? 'loaded'
        : failed.has(tabId) || loadErrors?.has(tabId)
          ? 'failed'
          : 'loading',
    [ownTabId, loadedTabIds, failed, loadErrors],
  );
  const request = useCallback(
    (tabId: string) => {
      if (status(tabId) === 'loading') fetchTab(tabId);
    },
    [status, fetchTab],
  );
  const retry = useCallback(
    (tabId: string) => {
      setFailed((prev) => {
        if (!prev.has(tabId)) return prev;
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
      fetchTab(tabId);
    },
    [fetchTab],
  );
  const open = useCallback(
    (tabId: string) => {
      track('UI', 'Used', 'TabWindowOpen');
      openTab(tabId);
    },
    [openTab],
  );
  const choose = useCallback(
    (elementId: string, tabId: string) => {
      track('Element', 'Changed', 'TabWindowTab');
      commitElements((els) =>
        els.map((el) =>
          el.id === elementId && el.type === 'shape' && el.shape === 'tab-window'
            ? { ...el, windowTabId: tabId }
            : el,
        ),
      );
    },
    [commitElements],
  );
  return useMemo(
    () => ({
      tabs: shownTabs,
      ownTabId,
      status,
      request,
      retry,
      open,
      ...(canChoose ? { choose } : {}),
    }),
    [shownTabs, ownTabId, status, request, retry, open, canChoose, choose],
  );
}
