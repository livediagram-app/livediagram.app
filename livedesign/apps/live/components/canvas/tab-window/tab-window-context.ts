'use client';

// What a tab window on the canvas reads (docs/specs/009-elements/tab-window.md): the design's tabs, where each
// one's content is, and the few things a window does (ask for its tab, open it, show another). Provided once by the
// canvas host rather than threaded through every element.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Tab } from '@livedesign/design';
import { track } from '@/lib/telemetry';

export type TabWindowStatus = 'loaded' | 'loading' | 'failed';

export type TabWindowContextValue = {
  // The design's tabs this person sees, in tab-bar order, and the tab the canvas is on.
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
  // The editor's fetch of the named tabs' content; resolves to the ones that failed, once each has settled (a fetch
  // already under way elsewhere waited for).
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
  // The tabs a Retry is fetching: Loading while it runs, whatever failed before (the editor's own visit included).
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(() => new Set());
  // The tabs asked for and not yet settled, so many windows onto one tab ask once.
  const asked = useRef(new Set<string>());
  const fetchTab = useCallback(
    (tabId: string) => {
      if (asked.current.has(tabId)) return;
      asked.current.add(tabId);
      void loadTabs([tabId]).then((failures) => {
        asked.current.delete(tabId);
        setRetrying((prev) => {
          if (!prev.has(tabId)) return prev;
          const next = new Set(prev);
          next.delete(tabId);
          return next;
        });
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
    [loadTabs],
  );
  const status = useCallback(
    (tabId: string): TabWindowStatus =>
      tabId === ownTabId || loadedTabIds.has(tabId)
        ? 'loaded'
        : !retrying.has(tabId) && (failed.has(tabId) || loadErrors?.has(tabId))
          ? 'failed'
          : 'loading',
    [ownTabId, loadedTabIds, failed, loadErrors, retrying],
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
      setRetrying((prev) => (prev.has(tabId) ? prev : new Set(prev).add(tabId)));
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
