'use client';

import { useCallback, useMemo } from 'react';
import { stampTabKind, type Tab } from '@livehuddle/document';
import { useDocumentHistory } from '@/hooks/canvas/useDocumentHistory';
import type { EditorDocumentSlice } from './useEditorDocument';

// The document's tabs and their undo history, and the one commit choke point every edit passes (a committed tab
// stamped with its kind). A slice of useEditorState (../useEditorState.ts): it takes the slices composed before
// it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorHistory({ fromDocument }: { fromDocument: EditorDocumentSlice }) {
  const { initialTabs } = fromDocument;
  const {
    tabs,
    canUndo: canTabUndo,
    canRedo: canTabRedo,
    commit: rawCommitTabs,
    tick: rawTickTabs,
    markCheckpoint: rawMarkCheckpoint,
    cancelToCheckpoint: rawCancelToCheckpoint,
    reset: rawResetTabs,
    applyRemote: applyRemoteTabs,
    applyRemoteOp,
    undo: undoHistory,
    redo: redoHistory,
  } = useDocumentHistory(initialTabs);
  const canHistoryUndo = canTabUndo;
  const canHistoryRedo = canTabRedo;

  // A tick (a drag landing, a nudge, a resize, a slider) settles chips as a commit does.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) => rawTickTabs(mapTabs),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    rawCommitTabs((ts) => {
      // Tab kind: a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. One choke point, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views. Only the tabs this commit changed or added
      // are stamped: an untouched tab may be a placeholder whose content has not loaded, and stamping it would make
      // it look edited to the autosave (docs/specs/006-document/per-tab-storage.md).
      const before = new Set<Tab>(ts);
      return mapTabs(ts).map((t) => (before.has(t) ? t : stampTabKind(t)));
    });
  };
  const markCheckpoint = rawMarkCheckpoint;
  // Stable identity: usePerTabLoad takes this, and an identity that changed
  // every render once turned a failed tab load into a refetch on every
  // re-render (the 30s presence tick included), each one an Error report.
  const resetTabs = rawResetTabs;
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry, a cancelled drag
  // never happened).
  const cancelToCheckpoint = rawCancelToCheckpoint;

  // Stable id + name projection of the tabs for link-badge hover cards
  // (docs/specs/008-canvas/canvas-and-palette.md): keyed on a signature so it only changes when a tab is
  // added / removed / renamed, NOT on every element edit, keeping the
  // memoised element views from re-rendering as the user types.
  //
  // NUL and SOH separate the fields because neither can occur in an id or a
  // name, so no rename can forge a signature by containing the delimiter.
  // Written as ESCAPES, not literal bytes: as raw bytes they made this the
  // only non-text file in the repo, `file` reported it as `data`, and
  // ripgrep answered every search of it with "binary file matches" and moved
  // on. On the 2,800-line module that composes every editor hook and builds
  // EditorContext, that silently broke "find all usages": a dead-code sweep
  // saw a hook's definition and no callers, because every call site is in
  // here. Same runtime string, searchable source.
  const tabSig = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  const tabSummaries = useMemo(
    () =>
      tabSig === ''
        ? []
        : tabSig.split('\u0001').map((entry) => {
            const [id = '', name = ''] = entry.split('\u0000');
            return { id, name };
          }),
    [tabSig],
  );
  return {
    applyRemoteOp,
    applyRemoteTabs,
    canHistoryRedo,
    canHistoryUndo,
    cancelToCheckpoint,
    commitTabs,
    markCheckpoint,
    redoHistory,
    resetTabs,
    tabs,
    tickTabs,
    undoHistory,
    view: {
      tabs,
      tabSummaries,
    },
  };
}

export type EditorHistorySlice = ReturnType<typeof useEditorHistory>;
