'use client';

import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useTourSquare } from '@/hooks/editor/useTourSquare';
import { isEventStormingTab } from '@livediagram/document';
import { useLaneSettle } from '@/hooks/canvas/useLaneSettle';
import { useEditorHistory } from '../useEditorHistory';
import { useElementHelpers } from '../useElementHelpers';
import { usePruneInertSelection } from '@liveworkspace/workbench/hooks/canvas/usePruneInertSelection';
import { useLayersState } from '../useLayersState';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorEditingSlice } from './useEditorEditing';

// Layers, the creation gates they add, lane settling, undo and redo, and the placement helpers. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorLayers({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromComments,
  fromViewport,
  fromEditing,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromComments: EditorCommentsSlice;
  fromViewport: EditorViewportSlice;
  fromEditing: EditorEditingSlice;
}) {
  const { toast } = fromDocument;
  const {
    activeLayerStampRef,
    canHistoryRedo,
    canHistoryUndo,
    commitTabs,
    markCheckpoint,
    redoHistory,
    tickTabs,
    undoHistory,
  } = fromHistory;
  const {
    activeId,
    formatSourceId,
    readSelection,
    selectionStore,
    setEditingId,
    setFormatSourceId,
    setSelectedId,
  } = fromSelection;
  const { formatSettings } = fromTools;
  const { isReadOnly, participant } = fromCollaboration;
  const { activeTab } = fromComments;
  const { getViewportCenter } = fromViewport;
  const { activeTabLocked, commit, commitActiveTab, editsBlocked, structureBlocked } = fromEditing;

  // Layers domain slice (docs/specs/006-document/layers.md): the active layer, the panel /
  // context-menu ops, and the hidden / locked element-id sets every
  // interaction gate below reads.
  const layersState = useLayersState({
    activeId,
    activeTab,
    editsBlocked: structureBlocked,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    toastInfo: toast.info,
  });
  const {
    layers,
    activeLayerId,
    activeLayerBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
  } = layersState;
  // Refresh the commit choke point's stamp (see commitTabs above).
  // Active-layer stamp for the commit choke point below (docs/specs/006-document/layers.md). A ref
  // (not state): commitTabs is defined before the layers slice computes,
  // so the slice refreshes this every render and the closure reads the
  // latest value at commit time.
  useAssignRef(activeLayerStampRef, { tabId: activeId, layerId: activeLayerId });

  // Is this an event-storming board (docs/specs/021-event-storming/event-storming.md)? One layer, so this is just
  // tab data — it drives the palette, the stationery and the note menu.
  const esBoard = isEventStormingTab(activeTab);
  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (docs/specs/006-document/layers.md).
  const createBlocked = editsBlocked || activeLayerBlocked;
  // As structureBlocked, for the hooks that take createBlocked: shut to a Participant.
  const structureCreateBlocked = createBlocked || isReadOnly;

  // An older event-storming board is settled onto the lanes once
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane").
  useLaneSettle({
    activeTab,
    editsBlocked: structureBlocked,
    commitActiveTab,
    markSettled: (tabId) =>
      tickTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, esLanesSettled: true } : t))),
    toastInfo: toast.info,
  });

  // A layer turning hidden or locked drops its elements from the live selection (layers.md).
  usePruneInertSelection(layerInertIds, selectionStore);

  const tourSquare = useTourSquare({ activeId, tickTabs });

  // Undo / redo handlers. See useEditorHistory.
  const editorHistory = useEditorHistory({
    activeId,
    editsBlocked,
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    tabLocked: activeTabLocked,
    tickTabs,
    undoHistory,
    redoHistory,
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const { addBoxed, addBoxedAt, currentSelectionIds, selectionPrimary, applyFormatFromSource } =
    useElementHelpers({
      layerInertIds,
      readSelection,
      activeId,
      activeTab,
      // Creation-only helpers: additionally blocked while the active layer
      // is hidden / locked (docs/specs/006-document/layers.md). Open to a Participant that may add content
      // (docs/specs/013-workspace/share-roles.md): a sticky, text or image dragged from its palette lands through
      // addBoxedAt, and every commit it makes still passes participant.guardCommit.
      editsBlocked: contentAddBlocked({
        participating: participant.participating,
        canAddContent: participant.can.addContent,
        blocked: createBlocked,
        structureBlocked: structureCreateBlocked,
      }),
      formatSourceId,
      formatConfig: formatSettings.config,
      getViewportCenter,
      commit,
      commitTabs,
      setSelectedId,
      setEditingId,
      setFormatSourceId,
    });
  return {
    addBoxed,
    addBoxedAt,
    applyFormatFromSource,
    createBlocked,
    currentSelectionIds,
    esBoard,
    layerInertIds,
    layerLockedIds,
    layersState,
    redo,
    selectionPrimary,
    structureCreateBlocked,
    tick,
    undo,
    view: {
      tourSquare,
      // Layers (docs/specs/006-document/layers.md): the normalised stack, the session-scoped active
      // layer, per-layer element counts, the interaction-gate id sets, and
      // the panel / context-menu ops.
      layers,
      activeLayerId,
      activeLayerBlocked,
      // The whole creation gate: a locked tab, a view-only session, or a
      // hidden / locked active layer. The canvas reads it so the
      // insert-between preview (docs/specs/021-event-storming/event-storming.md) never offers a slot the drop
      // would refuse.
      createBlocked,
      layerHiddenIds,
      layerLockedIds,
      layerInertIds,
      layerCounts: layersState.layerCounts,
      setActiveLayer: layersState.setActiveLayer,
      addLayer: layersState.addLayer,
      renameLayer: layersState.renameLayer,
      removeLayer: layersState.removeLayer,
      toggleLayerVisibility: layersState.toggleLayerVisibility,
      toggleLayerLock: layersState.toggleLayerLock,
      reorderLayer: layersState.reorderLayer,
      mergeActiveLayer: layersState.mergeActiveLayer,
      setLayerOpacityLive: layersState.setLayerOpacityLive,
      clearLayer: layersState.clearLayer,
      hideOtherLayersOp: layersState.hideOthers,
      layerPreviewId: layersState.previewLayerId,
      setLayerPreviewId: layersState.setPreviewLayerId,
      // Event-storming workshop views (docs/specs/021-event-storming/event-storming.md).
      esBoard,
      // Menu-facing wrapper: moves the CURRENT selection
      // onto the picked layer.
      moveSelectedToLayer: (layerId: string) =>
        layersState.moveSelectionToLayer(currentSelectionIds(), layerId),
      canRedo,
      canUndo,
      redo,
      undo,
    },
  };
}

export type EditorLayersSlice = ReturnType<typeof useEditorLayers>;
