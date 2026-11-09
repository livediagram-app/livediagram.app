import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Tab } from '@livedesign/design';
import { apiLoadDesign, apiLoadShared, apiLoadTabRevisioned } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { rebaseLocalEdits } from './rebase-local-edits';
import {
  applyTabList,
  applyTabListOnScreen,
  tabListOf,
  type ResyncTabList,
} from './resync-tab-list';

// Re-hydrating a design in place after the room can't bridge our
// reconnect gap (docs/specs/012-collaboration/resync-without-reload.md). This used to be `window.location.reload()`:
// correct, but it also threw away the viewport, the selection, the whole
// undo stack, and any tab the user hadn't saved yet — for what is really
// just "re-read the tab rows from D1".
//
// What a reconnect gap can lose is the design's content: the tabs' content
// and the tab list (a peer's tab added, deleted, renamed or moved, a
// `design-meta` op), so a full resync reads both back. Everything else the
// editor holds (which tab is active, where the canvas is panned, what's
// selected, presence) is either unaffected or re-established by the reconnect.
export function useRoomResync(opts: {
  designId: string | null;
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
  setTabLoadErrors: Dispatch<SetStateAction<Set<string>>>;
  // Moves with the refetched content (useChangesetSeen). Stable.
  noteChangesetSeen: (tabId: string, rev: number) => void;
}) {
  const {
    designId,
    selfId,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    setTabLoadErrors,
    noteChangesetSeen,
  } = opts;

  // `tabIds` narrows the refetch to the tabs a relayed changeset could not bring
  // (docs/specs/024-agents/agent-changesets.md "What the room does"): an oversize relay, or one
  // that missed an earlier changeset. That is no resync, so it is not counted as one.
  return useCallback(
    async (scope?: { tabIds?: string[] }) => {
      if (!designId) return;
      if (!scope?.tabIds) track('Error', 'Client', 'RealtimeResync');
      // Only tabs we actually hold content for. An unvisited placeholder has
      // nothing to correct, and usePerTabLoad will fetch it on first open
      // anyway — refetching it here would just race that.
      const targets = tabsRef.current
        .map((t) => t.id)
        .filter((id) => loadedTabIdsRef.current.has(id))
        .filter((id) => !scope?.tabIds || scope.tabIds.includes(id));
      const [list, ...fetched] = await Promise.all([
        // The tab list, on a full resync only: a narrowed refetch is about content alone.
        scope?.tabIds ? null : loadTabList(selfId, designId, sessionShareCode),
        ...targets.map(async (id) => {
          try {
            return await apiLoadTabRevisioned(selfId, designId, id, sessionShareCode);
          } catch {
            return null;
          }
        }),
      ]);
      const byId = new Map<string, Tab>();
      const revs = new Map<string, number>();
      for (const loaded of fetched) {
        if (!loaded) continue;
        byId.set(loaded.tab.id, loaded.tab);
        revs.set(loaded.tab.id, loaded.rev);
      }
      if (byId.size === 0 && !list) {
        // Every fetch failed — almost certainly the same outage that broke
        // the socket. Leave local state alone (it's the better copy right
        // now) and let usePerTabLoad's retry path own the recovery.
        return;
      }
      // Unlike usePerTabLoad's merge, this replaces tabs that already hold
      // content: we know we missed ops, so the server's copy is the base. What
      // was edited here and not yet saved goes back on top of it
      // (rebaseLocalEdits), judged against the baseline before it moves.
      const savedTabs = lastSavedTabsRef.current;
      const savedBefore = new Map(savedTabs.map((t) => [t.id, t] as const));
      const loaded = loadedTabIdsRef.current;
      const overwrite = (prev: Tab[]): Tab[] =>
        (list ? applyTabList(prev, list, loaded) : prev).map((t) => {
          const next = byId.get(t.id);
          // Keep the local folder: per-design link metadata (docs/specs/006-design/tab-folders.md) owned
          // by the meta path, not the content fetch.
          return next ? { ...next, folder: t.folder } : t;
        });
      // The list first, as a peer's `design-meta` op is applied: a tab added or deleted here and not saved yet stays
      // as it is here.
      applyRemoteTabs((prev) =>
        (list ? applyTabListOnScreen(prev, list, loaded, savedTabs) : prev).map((t) => {
          const next = byId.get(t.id);
          if (!next) return t;
          return { ...rebaseLocalEdits(next, t, savedBefore.get(t.id)), folder: t.folder };
        }),
      );
      // In the same batch as the content it describes (useChangesetSeen).
      for (const [tabId, rev] of revs) noteChangesetSeen(tabId, rev);
      // Inbound, not a local edit: moving the baseline with it is what keeps
      // the autosave from pushing the swap back up (docs/specs/012-collaboration/collab-race-hardening.md).
      lastSavedTabsRef.current = overwrite(lastSavedTabsRef.current);
      // Any tab we just refetched successfully is no longer in error.
      setTabLoadErrors((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const id of byId.keys()) next.delete(id);
        return next.size === prev.size ? prev : next;
      });
    },
    [
      designId,
      selfId,
      sessionShareCode,
      tabsRef,
      loadedTabIdsRef,
      applyRemoteTabs,
      lastSavedTabsRef,
      setTabLoadErrors,
      noteChangesetSeen,
    ],
  );
}

// The design's stored tab list, through the share link for a visitor. Null when it can't be read: the content refetch
// still runs, and the next resync or reload reads the list again.
async function loadTabList(
  selfId: string,
  designId: string,
  shareCode: string | null,
): Promise<ResyncTabList | null> {
  try {
    if (shareCode) {
      const shared = await apiLoadShared(shareCode, selfId, designId);
      return shared && 'design' in shared ? tabListOf(shared.design) : null;
    }
    const design = await apiLoadDesign(selfId, designId);
    return design ? tabListOf(design) : null;
  } catch {
    return null;
  }
}
