import { useTourSquare } from '@/hooks/editor/useTourSquare';
import type { Element, Tab } from '@livedocuments/document';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import { getTheme } from '@/lib/themes';
import { usePruneInertSelection } from '@liveworkspace/workbench/hooks/canvas/usePruneInertSelection';
import { useLayersState } from '../useLayersState';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorPages } from './useEditorPages';

// Layers and style memory: what the next element is styled with, the remembering commits the style setters use, the
// layers slice and its inert ids, the active layer's stamp for the commit choke point, the creation gate, and the
// tour's square.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorLayers({
  documentSlice,
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
  pagesSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
  pagesSlice: EditorPages;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { activeLayerStampRef, tickTabs } = documentSlice;
  const { activeId, selectionStore } = selectionSlice;
  const { toast, documentId } = sessionSlice;
  const { tabsRef } = persistenceSlice;
  const { activeTab } = collaborationSlice;
  const { canvasInertIds, editsBlocked, structureBlocked, commit } = pagesSlice;
  // Style memory (docs/specs/008-canvas/quick-style-panel.md): what the panel or the context menu last
  // chose per element kind, applied to the next element the user draws. The
  // style hooks below get `commit` / `tickTabs` wrapped to record into it.
  const activeTheme = getTheme(activeTab.theme);
  const styleMemory = useStyleMemory({
    documentId,
    theme: activeTheme,
  });
  const liveActiveElements = () =>
    (tabsRef.current.find((t) => t.id === activeId) ?? activeTab).elements;
  const rememberingCommit = (mapElements: (els: Element[]) => Element[]) => {
    const before = liveActiveElements();
    commit(mapElements);
    if (!editsBlocked) styleMemory.recordEdit(before, mapElements(before));
  };
  const rememberingTickTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    const beforeTabs = tabsRef.current;
    tickTabs(mapTabs);
    const before = beforeTabs.find((t) => t.id === activeId)?.elements;
    const after = mapTabs(beforeTabs).find((t) => t.id === activeId)?.elements;
    if (before && after && !editsBlocked) styleMemory.recordEdit(before, after);
  };

  // Layers domain slice (docs/specs/006-document/layers.md): the active layer, smart naming, and the
  // hidden / locked element-id sets every interaction gate below reads.
  const layersState = useLayersState({
    activeId,
    activeTab,
    editsBlocked: structureBlocked,
    tickTabs,
    toastInfo: toast.info,
    extraInertIds: canvasInertIds,
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
  useAssignRef(activeLayerStampRef, {
    tabId: activeId,
    layerId: activeLayerId,
  });

  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (docs/specs/006-document/layers.md).
  // Shut to a Participant, who adds nothing (docs/specs/013-workspace/share-roles.md).
  const createBlocked = structureBlocked || activeLayerBlocked;

  // A layer turning hidden or locked drops its elements from the live selection (layers.md).
  usePruneInertSelection(layerInertIds, selectionStore);

  // The tour's own square, with no history (TourHost).
  const tourSquare = useTourSquare({ activeId, tickTabs });

  return {
    activeTheme,
    styleMemory,
    liveActiveElements,
    rememberingCommit,
    rememberingTickTabs,
    layersState,
    layers,
    activeLayerId,
    activeLayerBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
    createBlocked,
    tourSquare,
  };
}

export type EditorLayers = ReturnType<typeof useEditorLayers>;
