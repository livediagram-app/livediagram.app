import { useBoardDeleteGuard } from '@/hooks/plan/useBoardDeleteGuard';
import { chainDeleteGuards } from '@/lib/delete-guards';
import { useSheetDeleteGuard } from '@/hooks/sheets/useSheetDeleteGuard';
import { useEffect, useCallback, useMemo } from 'react';
import type { Tab } from '@liveplanner/project';
import { useBehaviourElements } from '@/hooks/canvas/useBehaviourElements';
import { useCollabElements } from '@/hooks/canvas/useCollabElements';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useBurstCheckpoint } from '@liveworkspace/workbench/hooks/canvas/useBurstCheckpoint';
import { track } from '@/lib/telemetry';
import { useApplyStyleToAllTabs } from '@liveworkspace/workbench/hooks/editor/useApplyStyleToAllTabs';
import { withStyleOfTab } from '@/lib/tab-theme-apply';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useTabCanvas } from '@/hooks/canvas/useTabCanvas';
import { useTabSession } from '@/hooks/persistence/useTabSession';
import { useElementCreation } from '../useElementCreation';
import { useInlineIconMutators } from '../useInlineIconMutators';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorPlanSlice } from './useEditorPlan';
import type { EditorTabsSlice } from './useEditorTabs';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The tab's look and layout, Apply to All Tabs, session tools (timer, votes), behaviour and collaboration
// elements, notes, element creation, inline icons, cell links and the delete guards.
export function useEditorTabTools(
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  dialogsSlice: EditorDialogsSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
  planDataSlice: EditorPlanDataSlice,
  editingSlice: EditorEditingSlice,
  planSlice: EditorPlanSlice,
  tabsSlice: EditorTabsSlice,
) {
  const { activeId, setEditingId, setSelectedId } = selectionSlice;
  const {
    commitTabs,
    loadedTabIdsRef,
    markCheckpoint,
    selfParticipant,
    tabs,
    tickTabs,
    voteSelfId,
  } = projectSlice;
  const { setCanvasTool } = dialogsSlice;
  const { applyElementDelta, confirm, isStructureReadOnly, livePresence, roomRef, toast } =
    collaborationSlice;
  const { tabsRef } = persistenceSlice;
  const { activeTab, itemTypes, loadAllTabs, planItems, sheets } = planDataSlice;
  const { commit, createBlocked, editsBlocked, runsBlocked, structureBlocked, styleMemory } =
    editingSlice;
  const { plan } = planSlice;
  const { addBoxedAt, deleteTab, returnToHandRef, tick } = tabsSlice;
  // One undo step per burst of a continuous control: the background
  // sliders (useTabCanvas) and the element colour / opacity pickers
  // (useElementStyle). See useBurstCheckpoint.
  const checkpointBurst = useBurstCheckpoint(markCheckpoint);

  // Tab-level appearance + layout actions (theme switch, background
  // pattern / colour / opacity / pattern-colour, reset-to-theme,
  // auto-align). All mutate the active tab; see useTabCanvas.
  const {
    autoAlignTab,
    autoLayoutTab,
    setTabFinish,
    applyTabLook,
    setTabFont,
    setTabDefaultTextSize,
    setBackgroundPattern,
    setTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
  } = useTabCanvas({
    notify: (message) => toast.info(message),
    editsBlocked: structureBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    checkpointBurst,
  });

  // Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): the open tab's style on every tab, as one
  // undo step, an Editor's of the whole plan only.
  const { applyToAllTabs: applyStyleToAllTabs, applying: applyingStyleToAllTabs } =
    useApplyStyleToAllTabs<Tab>({
      canApply: !structureBlocked && !isStructureReadOnly,
      activeId,
      loadAllTabs,
      isTabLoaded: (id) => loadedTabIdsRef.current.has(id),
      commitTabs,
      restyle: withStyleOfTab,
      notify: (message) => toast.info(message),
      onApplied: () => track('Tab', 'Changed', 'AllTabs'),
    });

  // Live session tools (docs/specs/012-collaboration/session-tools.md): timer + dot-voting handlers.
  // State lives on the tab (`activeTab.timer` / `activeTab.vote`), so the
  // UI reads it straight off the tab; these are just the mutators.
  const {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    setVoteReviewIndex,
    castVote,
    retractVote,
  } = useTabSession({
    editsBlocked,
    runsBlocked,
    activeId,
    activeTab,
    // The non-history mutator, per docs/specs/012-collaboration/session-tools.md: starting a timer or
    // placing a dot isn't undoable (and mustn't evict real edits
    // from the bounded undo stack).
    commitTabs: tickTabs,
    // Dots and the host are keyed by the collab key, not the owner id: the
    // owner id is a guest's credential, and a dot op broadcasts its voter to
    // every socket in the room (docs/specs/012-collaboration/collab-race-hardening.md, docs/specs/012-collaboration/participant-responses.md).
    selfId: voteSelfId,
    // Straight down the socket, ahead of the autosave (docs/specs/012-collaboration/session-tools.md). A no-op
    // before the room is open, exactly like every other presence-speed send —
    // a solo vote still works, it just has nobody to tell.
    emitVote: (tabId, elementId, delta, round) =>
      roomRef.current?.send({
        kind: 'op',
        op: {
          kind: 'vote',
          tabId,
          elementId,
          voter: voteSelfId,
          delta,
          ...(round ? { round } : {}),
        },
      }),
  });

  // The interactive Behaviour elements that act on the SESSION rather than the
  // project (docs/specs/012-collaboration/session-button.md, /107): the session button's press and the
  // picker's roll.
  const { pressSessionButton, pickerFor, setSessionConfigFor } = useBehaviourElements({
    activeId,
    commitTabs,
    tickTabs,
    editsBlocked,
    selfParticipant,
    livePresence,
    activeTimer: activeTab.timer,
    activeVote: activeTab.vote,
    startTimer,
    pauseTimer,
    resumeTimer,
    startVote,
  });

  // The collaboration elements (docs/specs/012-collaboration/participant-responses.md). Sibling of the
  // behaviour hook above: these write to the project through `tickTabs`,
  // which does NOT push undo history, so one person's Ctrl+Z can never
  // retract another person's answer (docs/specs/012-collaboration/collab-race-hardening.md).
  const collabElements = useCollabElements({
    activeId,
    tickTabs,
    applyElementDelta,
    activeElements: activeTab.elements,
    editsBlocked,
    selfParticipant,
  });
  // A checklist tick is a room press like an answer (docs/specs/012-collaboration/collab-race-hardening.md).
  const { toggleChecklistItem } = collabElements;
  // Per-element note popover (single plain-text paragraph; see
  // packages/project BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  useEffect(() => {
    returnToHandRef.current = () => setCanvasTool('pan');
  });
  // Start Planning's placements and the double-click Text box. See useElementCreation.
  const { dropPaletteItem, handleCanvasDoubleClick } = useElementCreation({
    editsBlocked: createBlocked,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxedAt,
    styleNewElement: styleMemory.styleNewElement,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators: editsBlocked, commit and the elements.
  const { removeIconFromElement, dropIconElementOnShape } = useInlineIconMutators({
    editsBlocked,
    commit,
    tick,
  });

  // Per-cell table links (docs/specs/008-canvas/canvas-and-palette.md). Which cell's link picker is open +
  // the history-committed write into that cell's style. See
  // useCellLinkPicker; the shared LinkPickerDialog renders against it
  // in EditorView.
  const { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink } =
    useCellLinkPicker({ editsBlocked, commit });

  // Deleting a Sheet asks before taking its sheet (docs/specs/029-sheets/sheet-store.md "Deleting a sheet").
  const readTabsForSheets = useCallback(() => tabsRef.current, [tabsRef]);
  const sheetDeleteGuard = useSheetDeleteGuard({
    readTabs: readTabsForSheets,
    activeTabId: activeId,
    confirm,
    sheetsAttached: sheets.sheetsAttached,
    sheetTitle: sheets.sheetTitle,
    releaseSheets: sheets.releaseSheets,
  });
  // Deleting a board offers to take the card types no other board shows, and their cards (plan-board.md "Deleting a
  // board"), asked after the Sheet's question.
  const allTabsLoaded = useCallback(
    () => tabsRef.current.every((t) => loadedTabIdsRef.current.has(t.id)),
    [tabsRef, loadedTabIdsRef],
  );
  const boardDeleteGuard = useBoardDeleteGuard({
    readTabs: readTabsForSheets,
    activeTabId: activeId,
    confirm,
    allTabsLoaded,
    types: itemTypes.types,
    items: planItems.items,
    trashItems: plan.context.trashItems,
    deleteType: itemTypes.deleteType,
  });
  // Deleting a tab with boards on it offers, as deleting a board does, to delete the card types no other tab's board or
  // dashboard shows, and their cards (docs/specs/026-plan/plan-board.md "Deleting a board"). The tab goes either way.
  const deleteTabWithCards = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      const boards = new Set(
        (tab?.elements ?? [])
          .filter((el) => el.type === 'shape' && el.shape === 'plan-board')
          .map((el) => el.id),
      );
      const asked =
        boards.size > 0 && !tab?.locked && tabs.length > 1 ? boardDeleteGuard(boards, tabId) : null;
      if (!asked) {
        deleteTab(tabId);
        return;
      }
      void asked.then((plan) => {
        deleteTab(tabId);
        plan?.release();
      });
    },
    [tabs, boardDeleteGuard, deleteTab],
  );
  const elementDeleteGuard = useMemo(
    () => chainDeleteGuards(sheetDeleteGuard, boardDeleteGuard),
    [sheetDeleteGuard, boardDeleteGuard],
  );
  return {
    applyCellLink,
    applyStyleToAllTabs,
    applyTabLook,
    applyingStyleToAllTabs,
    autoAlignTab,
    autoLayoutTab,
    castVote,
    cellLinkPickerOpenFor,
    checkpointBurst,
    clearTimer,
    clearVote,
    closeNote,
    collabElements,
    deleteTabWithCards,
    dropIconElementOnShape,
    dropPaletteItem,
    elementDeleteGuard,
    endVote,
    extendTimer,
    handleCanvasDoubleClick,
    noteOpenId,
    openCellLinkPicker,
    openNote,
    pauseTimer,
    pickerFor,
    pressSessionButton,
    removeIconFromElement,
    resetTimer,
    resumeTimer,
    retractVote,
    revealVote,
    setBackgroundAnimationSpeed,
    setBackgroundColor,
    setBackgroundOpacity,
    setBackgroundPattern,
    setBackgroundPatternScale,
    setCellLinkPickerOpenFor,
    setNote,
    setPatternColor,
    setSessionConfigFor,
    setTabDefaultTextSize,
    setTabFinish,
    setTabFont,
    setTheme,
    setTimerDuration,
    setVoteReviewIndex,
    startTimer,
    startVote,
    toggleChecklistItem,
  };
}

export type EditorTabToolsSlice = ReturnType<typeof useEditorTabTools>;
