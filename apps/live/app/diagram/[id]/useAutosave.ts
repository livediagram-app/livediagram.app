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
  type DiagramListItem,
} from '@/lib/api-client';
import type { SaveStatus } from '@/components/EditorHeader';
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
      const { changedTabs, deletedIds, orderChanged, nameChanged, hasChanges } = computeTabSaveDiff(
        lastSavedTabsRef.current,
        tabs,
        lastSavedNameRef.current,
        diagramName,
        loadedTabIdsRef.current,
      );
      if (!hasChanges) return;
      const apiBase = '/api';
      const headers: Record<string, string> = {
        'X-Owner-Id': selfId,
        'Content-Type': 'application/json',
      };
      if (sessionShareCode) headers['X-Share-Code'] = sessionShareCode;
      for (const t of changedTabs) {
        // Strip UI-only / link-only fields (`templateChosen`, `folder`)
        // before persisting the body, mirroring apiSaveTab's
        // stripUiTabFields. `folder` is per-diagram link metadata
        // (spec/30) and rides the meta PUT below, never the body.
        const { templateChosen: _tc, folder: _f, ...persistable } = t;
        void _tc;
        void _f;
        // Authorise an empty-body overwrite only for a loaded tab (a real
        // reset / delete-all) — mirrors the debounced path so the server
        // data-loss backstop (spec/13) can't be tripped by a placeholder.
        const tabHeaders = loadedTabIdsRef.current.has(t.id)
          ? { ...headers, 'X-Allow-Empty': '1' }
          : headers;
        fetch(`${apiBase}/diagrams/${diagramId}/tabs/${t.id}`, {
          method: 'PUT',
          headers: tabHeaders,
          body: JSON.stringify(persistable),
          keepalive: true,
        }).catch(() => {});
      }
      for (const tabId of deletedIds) {
        const getHeaders: Record<string, string> = { 'X-Owner-Id': selfId };
        if (sessionShareCode) getHeaders['X-Share-Code'] = sessionShareCode;
        fetch(`${apiBase}/diagrams/${diagramId}/tabs/${tabId}`, {
          method: 'DELETE',
          headers: getHeaders,
          keepalive: true,
        }).catch(() => {});
      }
      if (orderChanged || nameChanged) {
        fetch(`${apiBase}/diagrams/${diagramId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: diagramName,
            tabs: tabs.map((t) => ({ id: t.id, folder: t.folder })),
          }),
          keepalive: true,
        }).catch(() => {});
      }
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
