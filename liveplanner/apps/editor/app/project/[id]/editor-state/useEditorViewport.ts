import { useKeyboardAvoidance } from '@liveworkspace/workbench/hooks/canvas/useKeyboardAvoidance';
import { useRef } from 'react';
import { useEditorViewport as useViewportState } from '@/hooks/canvas/useEditorViewport';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useTabEntryEffects } from '../useTabEntryEffects';
import { useCollabDeepLinkCapture } from '../useCollabDeepLink';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { boundsOfElements } from '@/lib/changeset-reveals';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorPlanDataSlice } from './useEditorPlanData';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The viewport: pan, zoom and fitting, keyboard avoidance and pinch, a changeset's Show, the capabilities, and the
// tab-entry effects (the #t= pin, fit on entry, an Inbox link captured before them).
export function useEditorViewport(
  selectionSlice: EditorSelectionSlice,
  documentSlice: EditorDocumentSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
  planDataSlice: EditorPlanDataSlice,
) {
  const { activeId, readSelection, setActiveId } = selectionSlice;
  const { hydrated, loadedTabIds } = documentSlice;
  const { sharePasswordGate } = collaborationSlice;
  const { tabsRef } = persistenceSlice;
  const { activeTab } = planDataSlice;
  const {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    fitToBounds,
    focusOn,
    scrollIntoView,
  } = useViewportState({ activeTab, readSelection });
  // A phone's keyboard never hides the caret on the canvas (useKeyboardAvoidance).
  useKeyboardAvoidance({ canvasMainRef, zoomRef, setViewportOffset });

  // A tab we are about to land on already aimed, so the tab-entry
  // fit-to-screen below leaves it alone (it runs a frame later and would
  // otherwise snap the view straight back off the element).
  const skipTabFitRef = useRef<string | null>(null);

  // The toast's Show (docs/specs/024-agents/agent-changesets.md "In the editor", CS34): the tab, then
  // every element the changeset touched that is still there, framed no closer than 100%.
  const revealChangesetRef = useLatest((tabId: string, ids: readonly string[]) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    const bounds = tab ? boundsOfElements(tab.elements, ids) : null;
    if (!bounds) return;
    if (tabId !== activeId) {
      skipTabFitRef.current = tabId;
      setActiveId(tabId);
    }
    fitToBounds(bounds, { maxZoom: 1 });
  });
  // Server capabilities (GET /api/capabilities). Fetched once at mount.
  const { emailEnabled } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewport,
  });

  // Capture an Inbox element deep link BEFORE the tab-entry
  // effect below rewrites the hash to the plain #t= pin (docs/specs/013-workspace/inbox.md §1).
  // Consumed further down by useCollabDeepLink once the tab is ready.
  const collabDeepLink = useCollabDeepLinkCapture(hydrated);
  // The card a link is opening (useCardAddress): its address replaces the entry rather than adding one.
  const arrivingCardRef = useRef<string | null>(null);

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects.
  const { requestFit } = useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    tabLoaded: loadedTabIds.has(activeId),
    fitToScreen: () => {
      fitToScreen();
    },
    skipFitForTabRef: skipTabFitRef,
  });
  return {
    arrivingCardRef,
    canvasMainRef,
    collabDeepLink,
    emailEnabled,
    fitToScreen,
    focusOn,
    getViewportCanvasRect,
    getViewportCenter,
    isPinchingRef,
    requestFit,
    revealChangesetRef,
    scrollIntoView,
    setViewportOffset,
    setViewportZoom,
    skipTabFitRef,
    viewport,
    zoomRef,
  };
}

export type EditorViewportSlice = ReturnType<typeof useEditorViewport>;
