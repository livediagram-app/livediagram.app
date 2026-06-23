import { useEffect, useState } from 'react';

import type { SaveStatus } from '@/components/EditorHeader';
import type { useToast } from '@/hooks/ui/useToast';
import {
  apiListDiagrams,
  apiListSharedWith,
  type ChangeLogEntry,
  type DiagramListItem,
  type SharedWithItem,
  DIAGRAM_LIST_LOAD_SAFETY_MS,
} from '@/lib/api-client';

// Persistence-facing state for the editor: the autosave status pill, the
// diagram name (mirrored into the browser tab title), the Explorer's
// owned + shared diagram lists, the activity/audit change log, and the
// transient import-error toast. Plus the two list-refresh helpers the
// hydration + autosave paths call. A cohesive slice lifted out of
// useEditorState — same pattern as usePanelLayout / useEditorDialogs.
//
// The values render the header pill, footer "Saved X ago", Explorer
// lists and Activity panel; the setters are written by the autosave,
// hydration/bootstrap and room-op paths via the returned setters.
export function useEditorPersistence({ toast }: { toast: ReturnType<typeof useToast> }) {
  // Surfaced in the footer (bottom-right of the TabBar). The autosave
  // used to swallow errors silently which made an offline API look
  // identical to a successful save; the indicator below makes the
  // result visible. `savedAt` is the epoch ms of the last successful
  // write — drives the "Saved 2 minutes ago" relative-time string.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [diagramName, setDiagramName] = useState('Untitled diagram');
  // Reflect the diagram name in the browser tab so users with many
  // tabs open can spot the right one. Falls back to the bare brand
  // until hydration lands the real name.
  useEffect(() => {
    document.title = diagramName ? `${diagramName} | livediagram` : 'livediagram';
  }, [diagramName]);

  // Every diagram in the local store. Used by the Explorer to render its
  // list. Refreshed on hydration and after we save the current diagram
  // (so the Explorer's "Your diagrams" section reflects renames + first
  // saves in real time).
  const [diagramList, setDiagramList] = useState<DiagramListItem[]>([]);
  // True while the very first diagram-list fetch is in flight, so the
  // Explorer can render a skeleton instead of an empty "no diagrams"
  // state. We only flip this off — subsequent refreshes don't reset it
  // because they're triggered by saves and shouldn't blank the list.
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  // Diagrams shared with the current owner. Surfaced in the
  // Explorer's "Shared with you" accordion. Fetched alongside the
  // owned-diagram list and refreshed when the owner opens a new
  // share link in this tab.
  const [sharedDiagrams, setSharedDiagrams] = useState<SharedWithItem[]>([]);
  // Per-diagram audit log surfaced in the Activity Panel. Newest first.
  // Hydrated from the API for existing diagrams; appended to on every
  // commit. See specs/12-activity-and-audit.md.
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogLoading, setChangeLogLoading] = useState(true);
  // Brief error string surfaced by the Import-tab flow when the
  // picked file is malformed or its schema is newer than this
  // editor understands. Rendered as a transient toast under the
  // header — auto-clears after 6 seconds so the user isn't stuck
  // looking at it, and gets cleared on the next import attempt.
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!importError) return;
    const id = window.setTimeout(() => setImportError(null), 6000);
    return () => window.clearTimeout(id);
  }, [importError]);

  // Surface a toast when an autosave fails (network / 5xx). The header
  // pill already shows the 'error' status, but a failed save risks lost
  // work — the kind of critical update that warrants the louder bottom-
  // centre toast too. Fires on the transition into 'error'; the toast
  // layer dedupes a streak of retries while one is still on screen.
  useEffect(() => {
    if (saveStatus === 'error') {
      toast.error('Couldn’t save your changes. Check your connection.');
    }
  }, [saveStatus, toast]);

  // Diagram-list refresh, fired after every autosave so the
  // Explorer's "Updated X ago" timestamps stay fresh. Folders are
  // explicitly NOT refetched here — they only change via folder
  // mutations (create / rename / delete / move) which manage state
  // optimistically themselves. Pulling them every save spammed
  // /api/folders on every edit.
  const refreshDiagramList = (ownerId: string) => {
    const safety = window.setTimeout(
      () => setDiagramListLoading(false),
      DIAGRAM_LIST_LOAD_SAFETY_MS,
    );
    apiListDiagrams(ownerId)
      .then((list) => {
        window.clearTimeout(safety);
        setDiagramList(list);
        setDiagramListLoading(false);
      })
      .catch(() => {
        // Network glitch — the next save will retry. List staleness
        // for a beat is acceptable; we don't want a transient error
        // to wipe the rendered list. Drop the loading flag so the
        // Explorer doesn't spin forever on a dead network.
        window.clearTimeout(safety);
        setDiagramListLoading(false);
      });
    // Shared-with-you is deliberately NOT fetched here. The list
    // only changes when the user opens a NEW share URL (which
    // navigates the page → hydration picks it up) or when the
    // owner revokes shares (which the visitor won't see until
    // their next page load anyway). Fetching it on every
    // autosave-triggered refresh was burning a wasted GET
    // /api/shared per ~500ms of active editing.
  };
  // One-shot shared-list fetch, called from the hydration IIFE
  // alongside refreshDiagramList. Silent failure: the section
  // hides when empty so a network glitch just leaves the
  // accordion absent for this session.
  const refreshSharedList = (ownerId: string) => {
    apiListSharedWith(ownerId)
      .then((items) => setSharedDiagrams(items))
      .catch(() => {});
  };

  return {
    saveStatus,
    setSaveStatus,
    savedAt,
    setSavedAt,
    diagramName,
    setDiagramName,
    diagramList,
    setDiagramList,
    diagramListLoading,
    setDiagramListLoading,
    sharedDiagrams,
    setSharedDiagrams,
    changeLog,
    setChangeLog,
    changeLogLoading,
    setChangeLogLoading,
    importError,
    setImportError,
    refreshDiagramList,
    refreshSharedList,
  };
}
