import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import { apiLoadTab } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Re-hydrating a diagram in place after the room can't bridge our
// reconnect gap (spec/97). This used to be `window.location.reload()`:
// correct, but it also threw away the viewport, the selection, the whole
// undo stack, and any tab the user hadn't saved yet — for what is really
// just "re-read the tab rows from D1".
//
// The room's op log only carries content changes, so a resync only ever
// needs the tab CONTENT back. Everything else the editor holds (which tab
// is active, where the canvas is panned, what's selected, presence) is
// either unaffected or re-established by the reconnect itself.
export function useRoomResync(opts: {
  diagramId: string | null;
  selfId: string;
  sessionShareCode: string | null;
  tabsRef: MutableRefObject<Tab[]>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  // Merges into the present WITHOUT clearing undo/redo — the whole point
  // of re-hydrating rather than reloading.
  applyRemoteTabs: (updater: (prev: Tab[]) => Tab[]) => void;
  // The autosave's baseline. Must move with the fetched content, or the
  // next tick diffs fresh server state against a stale mirror and PUTs
  // the pre-resync tabs straight back over it.
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  remoteUpdateRef: MutableRefObject<boolean>;
  setTabLoadErrors: Dispatch<SetStateAction<Set<string>>>;
}) {
  const {
    diagramId,
    selfId,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    remoteUpdateRef,
    setTabLoadErrors,
  } = opts;

  return useCallback(async () => {
    if (!diagramId) return;
    track('Error', 'Client', 'RealtimeResync');
    // Only tabs we actually hold content for. An unvisited placeholder has
    // nothing to correct, and usePerTabLoad will fetch it on first open
    // anyway — refetching it here would just race that.
    const targets = tabsRef.current
      .map((t) => t.id)
      .filter((id) => loadedTabIdsRef.current.has(id));
    const fetched = await Promise.all(
      targets.map(async (id) => {
        try {
          return await apiLoadTab(selfId, diagramId, id, sessionShareCode);
        } catch {
          return null;
        }
      }),
    );
    const byId = new Map<string, Tab>();
    for (const tab of fetched) if (tab) byId.set(tab.id, tab);
    if (byId.size === 0) {
      // Every fetch failed — almost certainly the same outage that broke
      // the socket. Leave local state alone (it's the better copy right
      // now) and let usePerTabLoad's retry path own the recovery.
      return;
    }
    // Unlike usePerTabLoad's merge, this deliberately OVERWRITES tabs that
    // already hold content. That's the entire job: we know we missed ops,
    // so local content is the stale copy and the server's is authoritative.
    const overwrite = (prev: Tab[]): Tab[] =>
      prev.map((t) => {
        const next = byId.get(t.id);
        // Keep the local folder: per-diagram link metadata (spec/30) owned
        // by the meta path, not the content fetch.
        return next ? { ...next, folder: t.folder } : t;
      });
    applyRemoteTabs(overwrite);
    lastSavedTabsRef.current = overwrite(lastSavedTabsRef.current);
    // Inbound, not a local edit — keeps the autosave from treating the
    // swap as a change to push back up.
    remoteUpdateRef.current = true;
    // Any tab we just refetched successfully is no longer in error.
    setTabLoadErrors((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of byId.keys()) next.delete(id);
      return next.size === prev.size ? prev : next;
    });
  }, [
    diagramId,
    selfId,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    remoteUpdateRef,
    setTabLoadErrors,
  ]);
}
