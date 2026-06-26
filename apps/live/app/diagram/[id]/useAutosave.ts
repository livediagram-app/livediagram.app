import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Tab } from '@livediagram/diagram';
import {
  apiDeleteTab,
  apiSaveDiagramMeta,
  apiSaveTab,
  connectRoom,
  flushDiagramSavesBeacon,
  type DiagramListItem,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { isDiagramDeleted } from '@/lib/diagram-tombstones';
import { computeTabSaveDiff } from './editor-page-helpers';

// Per-tab autosave (spec/13), lifted out of editor-page.tsx. Two effects:
// a debounced (600ms) save and a beforeunload flush so a fast edit ->
// reload doesn't lose changes. Both diff via the tested computeTabSaveDiff
// kernel. The last-saved mirror refs live in the page (the hydration
// effect seeds them) and are passed in, as are the realtime room ref and
// the status/list setters.
export function useAutosave(opts: {
  hydrated: boolean;
  diagramId: string | null;
  isReadOnly: boolean;
  tabs: Tab[];
  diagramName: string;
  selfId: string;
  sessionShareCode: string | null;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  // The set of tabs whose content is authoritative in memory (hydrated /
  // fetched / locally-created). Gates the content-write diff so a never-
  // opened placeholder can't be PUT back as empty — see computeTabSaveDiff.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  remoteUpdateRef: MutableRefObject<boolean>;
  roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSavedAt: Dispatch<SetStateAction<number | null>>;
  setDiagramList: Dispatch<SetStateAction<DiagramListItem[]>>;
}) {
  const {
    hydrated,
    diagramId,
    isReadOnly,
    tabs,
    diagramName,
    selfId,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteUpdateRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDiagramList,
  } = opts;

  useEffect(() => {
    if (!hydrated || !diagramId || isReadOnly) return;
    const handler = () => {
      // The user just deleted this diagram (navigating to /explorer fires
      // beforeunload): don't beacon its tabs/meta back and re-create it.
      if (isDiagramDeleted(diagramId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        diagramName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) return;
      // The raw keepalive writes live behind the api-client boundary now
      // (flushDiagramSavesBeacon) so this hook holds no fetch of its own.
      flushDiagramSavesBeacon({
        ownerId: selfId,
        diagramId,
        shareCode: sessionShareCode,
        changedTabs,
        deletedIds,
        loadedTabIds: loadedTabIdsRef.current,
        orderChanged,
        nameChanged,
        name: diagramName,
        tabs,
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // Omitted deps are all refs + state setters (stable by React's guarantee).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, isReadOnly, tabs, diagramName, selfId, sessionShareCode]);

  useEffect(() => {
    if (!hydrated || !diagramId) return;
    if (isReadOnly) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      // Bail if the diagram was just deleted (the debounce can still be
      // pending when the delete fires) so we don't re-create it.
      if (isDiagramDeleted(diagramId)) return;
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        diagramName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) return;

      setSaveStatus('saving');
      const writes: Promise<unknown>[] = [];
      for (const t of changedTabs) {
        writes.push(
          apiSaveTab(selfId, diagramId, t, sessionShareCode, {
            // A loaded tab's content is authoritative, so an empty body is
            // an intentional clear (reset-canvas / delete-all) the server
            // backstop should accept; an unloaded placeholder is never in
            // the set, so it can't authorise its own wipe (spec/13).
            allowEmpty: loadedTabIdsRef.current.has(t.id),
          }).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: { kind: 'tab', tabId: t.id, tab: t },
            });
          }),
        );
      }
      for (const tabId of deletedIds) {
        writes.push(apiDeleteTab(selfId, diagramId, tabId, sessionShareCode));
      }
      if (orderChanged || nameChanged) {
        writes.push(
          apiSaveDiagramMeta(
            selfId,
            {
              id: diagramId,
              name: diagramName,
              tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
            },
            sessionShareCode,
          ).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: {
                kind: 'diagram-meta',
                name: diagramName,
                tabs: tabs.map((t, i) => ({
                  id: t.id,
                  name: t.name,
                  orderIndex: i,
                  folder: t.folder,
                })),
              },
            });
          }),
        );
      }
      Promise.all(writes)
        .then(() => {
          lastSavedTabsRef.current = tabs;
          lastSavedNameRef.current = diagramName;
          setSaveStatus('saved');
          const now = Date.now();
          setSavedAt(now);
          // Bump the current diagram's row locally so the Explorer's
          // "Updated X ago" stays fresh — used to refetch the whole
          // list here, which hit /api/diagrams on every autosave.
          setDiagramList((prev) =>
            prev.map((d) => (d.id === diagramId ? { ...d, savedAt: now, name: diagramName } : d)),
          );
        })
        .catch(() => {
          setSaveStatus('error');
        });
    }, 600);
    return () => window.clearTimeout(handle);
    // Omitted deps are all refs + state setters (stable by React's guarantee).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, tabs, diagramName, selfId, isReadOnly, sessionShareCode]);
}
