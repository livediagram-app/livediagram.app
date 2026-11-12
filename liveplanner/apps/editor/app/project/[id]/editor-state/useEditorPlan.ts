import { useMergeDuplicateStatuses } from '@/hooks/plan/useMergeDuplicateStatuses';
import { useTypeStatusJoins } from '@/hooks/plan/useTypeStatusJoins';
import { usePresetCardTypes } from '@/hooks/plan/usePresetCardTypes';
import { usePlanSlice } from '@/hooks/plan/usePlanSlice';
import { usePlanTourLeftovers } from '@/hooks/plan/usePlanTourLeftovers';
import { useTourSquare } from '@/hooks/editor/useTourSquare';
import { useLinkedActionCards } from '@/hooks/plan/useLinkedActionCards';
import { actionsBoardIn } from '@/hooks/plan/linked-actions';
import { usePlanStatuses } from '@/hooks/plan/usePlanStatusNames';
import { useFormActions } from '@/hooks/forms/useFormActions';
import { useFormSheetColumns } from '@/hooks/forms/useFormSheetColumns';
import { makeFormSheet } from '@/lib/forms-make-sheet';
import { usePlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { usePlanTabConversion } from '@/hooks/plan/usePlanTabConversion';
import { usePlanCoverWiring } from '@/hooks/plan/usePlanCoverWiring';
import { useTeamPeople } from '@/hooks/plan/useTeamPeople';
import { useMemo } from 'react';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { createTab } from '../editor-page-helpers';
import { useCardAddress } from '../useCardAddress';
import { cardLink } from '@/lib/card-address';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorEditingSlice } from './useEditorEditing';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// Plan: statuses, preset card types, the Actions board, team people, Board, Sheet, Dashboard and Form tabs, the
// Plan slice handed to the canvas, the open card's address and the Plan tour.
export function useEditorPlan(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
  planDataSlice: EditorPlanDataSlice,
  viewportSlice: EditorViewportSlice,
  editingSlice: EditorEditingSlice,
) {
  const { accountUserId, workbenchMode } = env;
  const { activeId, setActiveId, setSelectedId } = selectionSlice;
  const {
    commitTabs,
    hydrated,
    loadedTabIds,
    markTabLoaded,
    projectId,
    selfParticipant,
    tabs,
    tickTabs,
  } = projectSlice;
  const {
    canEdit,
    isReadOnly,
    isStructureReadOnly,
    linkedActionsRef,
    participant,
    projectTeamId,
    toast,
  } = collaborationSlice;
  const { tabsRef } = persistenceSlice;
  const {
    activeTab,
    itemTypes,
    loadAllTabs,
    planItems,
    planPresence,
    pullRequests,
    sheets,
    teams,
  } = planDataSlice;
  const { arrivingCardRef } = viewportSlice;
  const { arriveAtLink, commit } = editingSlice;
  // Plan boards and cards (docs/specs/026-plan/): the item panel, board set-up and every action a board
  // takes, handed to the canvas through PlanContext. See usePlanSlice.
  // The tab's status names, read only where Plan is in play (docs/specs/026-plan/plan-mode.md "Cost").
  const {
    names: planStatusNames,
    phases: planStatusPhases,
    types: planStatusTypes,
    boards: planStatusBoards,
  } = usePlanStatuses(
    tabs,
    activeId,
    itemTypes.types.map((t) => t.id),
  );
  // One name, one state: duplicate states merge into the first. See useMergeDuplicateStatuses.
  useMergeDuplicateStatuses({
    tabs,
    enabled: canEdit && tabs.every((t) => loadedTabIds.has(t.id)),
    itemsReady: planItems.status === 'ready',
    items: planItems.items,
    tickTabs,
    writeQuiet: planItems.writeQuiet,
  });
  // A newly placed board brings its preset's card types (a Bug Triage board, Bug). See usePresetCardTypes.
  const presetCardTypes = usePresetCardTypes({
    tabs,
    activeId,
    enabled: hydrated && !isReadOnly,
    canBring: hydrated && !isReadOnly,
    itemsReady: planItems.status === 'ready',
    catalogue: itemTypes.catalogue,
    saveCatalogue: itemTypes.saveCatalogue,
  });
  // A new status joins only the card types its board takes, and old types take the ordered list. See
  // useTypeStatusJoins.
  useTypeStatusJoins({
    tabs,
    loadedTabIds,
    enabled: hydrated && !isStructureReadOnly,
    catalogue: itemTypes.catalogue,
    quietChange: itemTypes.quietChange,
  });
  // The Actions board (docs/specs/026-plan/linked-boards.md): every action has a card on it, kept together.
  const actionsBoard = useMemo(() => actionsBoardIn(tabs), [tabs]);
  const editorLevel = hydrated && participant.can.level === 'edit' && !workbenchMode;
  const linkedActions = useLinkedActionCards({
    tabs,
    loadedTabIds,
    board: actionsBoard,
    items: planItems,
    canHeal: editorLevel,
    canMakeBoard: editorLevel && !isStructureReadOnly,
    statusNames: planStatusNames,
    commitTabs,
    tickTabs,
    markTabLoaded,
    bringCardTypes: presetCardTypes.bring,
    loadTabs: loadAllTabs,
    arrive: (link) => {
      if (link.at) setActiveId(link.at.tabId);
      arriveAtLink(link);
    },
    announceBoard: (message, open) =>
      toast.action({
        key: 'actions-board',
        message,
        actions: [{ label: 'Open Board', onSelect: open }],
      }),
  });
  useAssignRef(linkedActionsRef, linkedActions);
  const linkedPlan = useMemo(
    () => ({ placeOf: linkedActions.placeOf, showOnCanvas: linkedActions.showOnCanvas }),
    [linkedActions.placeOf, linkedActions.showOnCanvas],
  );
  // Assignees: the members of the plan's team, never your other teams (docs/specs/026-plan/items.md "Who may do what").
  const teamPeople = useTeamPeople(
    selfParticipant.id,
    !workbenchMode,
    !!accountUserId,
    teams,
    projectTeamId,
  );
  // Whether a Plan board covers the canvas (docs/specs/026-plan/plan-board.md "Fill Tab"): see usePlanCoverWiring.
  const planCover = usePlanCoverWiring({ activeTab, tabs });
  // Board, Sheet and Dashboard tabs (docs/specs/026-plan/plan-tabs.md).
  const planTabs = usePlanTabActions({
    activeId,
    commitTabs,
    tickTabs,
    bringCardTypes: presetCardTypes.bring,
    markTabLoaded,
  });
  // Form tabs (docs/specs/030-forms/forms.md): starting one and every builder edit.
  const forms = useFormActions({
    activeId,
    tabs,
    commitTabs,
    tickTabs,
    itemTypes,
    statusNames: planStatusNames,
    markTabLoaded,
    openTab: setActiveId,
    makeSheet: (create) => void makeFormSheet(sheets.bridge, create),
    retitleSheets: sheets.retitleSheets,
  });
  // A sheet form's columns, there before any response and linked by column (docs/specs/030-forms/forms.md).
  useFormSheetColumns({
    tab: activeTab,
    canEdit: !isStructureReadOnly,
    bridge: sheets.bridge,
    changeFormQuietly: forms.changeFormQuietly,
  });
  // Old Plan tabs become the Plan kinds when an Editor opens them (docs/specs/026-plan/plan-tabs.md).
  usePlanTabConversion({
    activeTab,
    loaded: loadedTabIds.has(activeId),
    canReshape: !isStructureReadOnly,
    commitTabs,
    createTab,
    markTabLoaded,
  });
  const plan = usePlanSlice({
    planItems,
    pullRequests,
    itemTypes,
    canEdit: !isReadOnly,
    canEditCards: participant.can.planCards,
    // Card votes and card comments are a Participant's (docs/specs/013-workspace/share-roles.md).
    canVote: hydrated && participant.can.takePart,
    teamPeople,
    presence: planPresence.presence,
    publishPresence: planPresence.publish,
    commit,
    commitTabs,
    // Read when called (Edit Field's filter count), never on a render.
    readTabs: () => tabsRef.current,
    select: setSelectedId,
    announce,
    statusNames: planStatusNames,
    statusPhases: planStatusPhases,
    statusTypes: planStatusTypes,
    statusBoards: planStatusBoards,
    notify: toast.info,
    // A form is an Editor's to make (docs/specs/030-forms/forms.md "Who may do what").
    newFormFor: participant.can.level === 'edit' ? forms.newFormFor : undefined,
    linkedActions: linkedPlan,
    // Copy Card Link in the item panel's ⋯ menu (docs/specs/026-plan/plan-board.md "Its address").
    cardLink: (itemId) =>
      cardLink({
        origin: window.location.origin,
        projectId: projectId ?? '',
        search: window.location.search,
        tabId: activeId,
        itemId,
      }),
  });
  // The open card in the address, and Back and Forward over it (docs/specs/026-plan/plan-board.md "Its address").
  useCardAddress({
    hydrated,
    activeId,
    shownId: plan.openItemId && plan.context.items.has(plan.openItemId) ? plan.openItemId : null,
    openItemId: plan.openItemId,
    arrivingRef: arrivingCardRef,
    openItem: plan.context.openItem,
    closeItem: plan.closeItem,
  });
  // The Plan tour's example board and cards, or sheet (docs/specs/026-plan/plan-tour.md "Tour content").
  const tourSquare = useTourSquare({ activeId, tickTabs });
  usePlanTourLeftovers({
    projectId,
    hydrated,
    tickTabs,
    planItems,
    releaseSheets: sheets.releaseSheets,
  });
  return {
    forms,
    linkedActions,
    plan,
    planCover,
    planTabs,
    presetCardTypes,
    teamPeople,
    tourSquare,
  };
}

export type EditorPlanSlice = ReturnType<typeof useEditorPlan>;
