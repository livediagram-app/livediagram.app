'use client';

import { useCallback, useMemo, useRef } from 'react';
import { stampTabKind, stampNewElementLayers, type Tab } from '@livediagram/document';
import { settleFlowcharts } from '@livediagram/document';
import { settleChipsInTabs } from '@/lib/settle-tabs';
import { lockedElementIds } from '@/lib/tab-cleanup';
import { useReplayFreeze } from '@/lib/replay/useReplayFreeze';
import { useDocumentHistory } from '@/hooks/canvas/useDocumentHistory';
import type { EditorDocumentSlice } from './useEditorDocument';

// The document's tabs and their undo history, and the one commit choke point every edit passes (chips settled,
// flowcharts laid out, new elements stamped onto the active layer). A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorHistory({ fromDocument }: { fromDocument: EditorDocumentSlice }) {
  const { initialTabs } = fromDocument;
  // Read at call time by commitTabs and the checkpoint guards below, and filled where their values exist:
  // the active layer's stamp in useEditorLayers, whether a photo draft is open in useEditorEventStorming.
  const activeLayerStampRef = useRef<{ tabId: string; layerId: string } | null>(null);
  const photoDraftOpenRef = useRef(false);
  const {
    tabs,
    canUndo: canTabUndo,
    canRedo: canTabRedo,
    commit: historyCommit,
    tick: historyTick,
    markCheckpoint: rawMarkCheckpoint,
    cancelToCheckpoint: rawCancelToCheckpoint,
    reset: rawResetTabs,
    applyRemote: applyRemoteTabs,
    applyRemoteOp,
    undo: historyUndo,
    redo: historyRedo,
  } = useDocumentHistory(initialTabs);
  // Watch It Built's freeze (docs/specs/007-editor/blueprints/watch-it-built.md "The freeze"): while a replay runs
  // nothing writes the document, so an editor part that commits on its own (a label on blur) cannot save, send or
  // undo the demo. Remote applies are not frozen: collaborators' edits keep arriving.
  const {
    commit: rawCommitTabs,
    tick: rawTickTabs,
    undo: undoHistory,
    redo: redoHistory,
  } = useReplayFreeze({
    commit: historyCommit,
    tick: historyTick,
    undo: historyUndo,
    redo: historyRedo,
  });
  const canHistoryUndo = canTabUndo;
  const canHistoryRedo = canTabRedo;

  // A tick (a drag landing, a nudge, a resize, a slider) settles chips as a commit does.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) => rawTickTabs((ts) => settleChipsInTabs(ts, mapTabs(ts))),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    // Layer stamping (docs/specs/006-document/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, AI, template, Mermaid
    // import) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      // Tab kind (docs/specs/021-event-storming/event-storming.md): a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. Same choke point as the layer stamp below, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views. Only the tabs this commit changed or added
      // are stamped: an untouched tab may be a placeholder whose content has not loaded, and stamping it would make
      // it look edited to the autosave (docs/specs/006-document/per-tab-storage.md).
      const before = new Set<Tab>(ts);
      // Flowcharts (docs/specs/009-elements/flowchart.md "The layout"): a chart whose structure this
      // commit changed (an arrow drawn between steps, a step deleted, a step dragged into another
      // lane) is laid out again in the same commit, whichever path made the change.
      const mapped = mapTabs(ts).map((t) => {
        if (before.has(t)) return t;
        const prev = ts.find((p) => p.id === t.id);
        const settled = prev
          ? settleFlowcharts(prev.elements, t.elements, () =>
              lockedElementIds(t.elements, t.layers),
            )
          : t.elements;
        return stampTabKind(settled === t.elements ? t : { ...t, elements: settled });
      });
      // Badges and step numbers (docs/specs/009-elements/badge.md "Attachment"), after any chart re-layout moved
      // their hosts.
      const next = settleChipsInTabs(ts, mapped);
      const stamp = activeLayerStampRef.current;
      if (!stamp) return next;
      return next.map((t) => {
        if (t.id !== stamp.tabId) return t;
        const prev = ts.find((p) => p.id === t.id);
        const els = stampNewElementLayers(
          prev?.elements ?? [],
          t.elements,
          t.layers,
          stamp.layerId,
        );
        return els === t.elements ? t : { ...t, elements: els };
      });
    });
  };
  const markCheckpoint = () => {
    // A gesture inside the draft (dragging a draft note) must not push a step
    // of its own, or Undo after Add would stop at that drag instead of taking
    // the whole import back.
    if (photoDraftOpenRef.current) return;
    rawMarkCheckpoint();
  };
  // Stable identity: usePerTabLoad takes this, and an identity that changed
  // every render once turned a failed tab load into a refetch on every
  // re-render (the 30s presence tick included), each one an Error report.
  const resetTabs = rawResetTabs;
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry, a cancelled drag
  // never happened).
  // Restore the armed checkpoint and DISCARD the step. The photo draft's own
  // Discard calls this directly: it is the gesture's owner, so it is the one
  // caller that always means it.
  const cancelGesture = () => {
    rawCancelToCheckpoint();
  };
  const cancelToCheckpoint = () => {
    // Inside a draft there is no per-gesture checkpoint for anyone ELSE to go
    // back to — the draft's own is the only one, and popping it because a drag
    // was cancelled would take the whole import with it. The dragged note
    // simply stays where it was let go; Discard is how you undo the import.
    if (photoDraftOpenRef.current) return;
    cancelGesture();
  };

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
    activeLayerStampRef,
    applyRemoteOp,
    applyRemoteTabs,
    canHistoryRedo,
    canHistoryUndo,
    cancelGesture,
    cancelToCheckpoint,
    commitTabs,
    markCheckpoint,
    photoDraftOpenRef,
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
