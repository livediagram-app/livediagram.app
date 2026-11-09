import { useMemo } from 'react';
import { type BoxedElement, isBoxed, elementActions } from '@liveplanner/project';
import { apiNotifyActionAssigned } from '@/lib/api-client';
import {
  commentRowsFromElements,
  actionRowsFromElements,
} from '@/components/panels/CollaboratePanel';
import { useEditorActions } from '@/hooks/collab/useEditorActions';
import { usePresenceRows } from '../usePresenceRows';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPlanDataSlice } from './useEditorPlanData';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The Collaborate panel's rows: presence rows, comment rows, assigned actions and their rows; and the join
// screen's flags.
export function useEditorComments(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  documentSlice: EditorDocumentSlice,
  collaborationSlice: EditorCollaborationSlice,
  planDataSlice: EditorPlanDataSlice,
) {
  const { accountDisplayName, accountUserId, embedMode, workbenchMode } = env;
  const { activeId, identityPromptOpen } = selectionSlice;
  const {
    hydrated,
    loadedExistingProject,
    nameConfirmed,
    projectId,
    selfParticipant,
    tabs,
    tickTabs,
  } = documentSlice;
  const {
    linkedActionsRef,
    liveAgents,
    livePresence,
    peerMotion,
    presenceClock,
    projectShareable,
    projectTeamId,
    remoteSelections,
    remoteTabFocus,
  } = collaborationSlice;
  const { activeTab, voteCursorsHidden } = planDataSlice;
  // Derived realtime presence rows (avatars per tab, remote cursors,
  // per-element selections) and the concurrent-selection lock
  // (docs/specs/007-editor/editor-app.md). Pure derivation over the usePresenceState values.
  // See usePresenceRows.
  const {
    participantsByTab,
    peerRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
  } = usePresenceRows({
    projectShareable,
    projectTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteSelections,
    peerMotion,
    cursorsHidden: voteCursorsHidden,
  });
  // Comment-bearing element rows for the floating Comments panel.
  // Only the boxed elements carry threads (arrows can't), so the
  // filter walks `activeTab.elements` and routes the boxed ones
  // through the helper. The memo keys on the element list identity
  // so a selection / pan / zoom that doesn't touch elements skips
  // recomputation.
  const commentRows = useMemo(() => {
    const boxed: BoxedElement[] = activeTab.elements.filter((el): el is BoxedElement =>
      isBoxed(el),
    );
    return commentRowsFromElements(boxed);
  }, [activeTab.elements]);

  // Assigned-action state + handlers (docs/specs/012-collaboration/assigned-actions.md), the comments hook's
  // sibling: the popover open-id, the Assign Action dialog target, and
  // the save / complete / reopen / delete mutations. Mutations bypass
  // history like comments (Cmd+Z must never silently unassign work).
  // The email notify is fire-and-forget through the api worker, which
  // re-verifies team membership + project access server-side.
  const {
    actionPopoverOpenId,
    openActionPopover,
    closeActionPopover,
    assignActionFor,
    assignActionId,
    openAssignActionDialog,
    closeAssignActionDialog,
    openAssignAction,
    saveAction,
    completeAction,
    reopenAction,
    wontDoAction,
    deleteAction,
  } = useEditorActions({
    activeId,
    tickTabs,
    onCreated: () => linkedActionsRef.current?.noteActionAdded(activeId),
    getAction: (elementId, actionId) => {
      const el = activeTab.elements.find((e) => e.id === elementId);
      if (!el || !isBoxed(el)) return undefined;
      const list = elementActions(el);
      return actionId ? list.find((a) => a.id === actionId) : list[0];
    },
    isActionCard: (elementId) =>
      activeTab.elements.some(
        (e) => e.id === elementId && e.type === 'shape' && e.shape === 'action-card',
      ),
    actionCount: (elementId) => {
      const el = activeTab.elements.find((e) => e.id === elementId);
      return el && isBoxed(el) ? elementActions(el).length : 0;
    },
    // The signed-in account, or the hydrated guest participant identity
    // (guests may self-assign, docs/specs/012-collaboration/assigned-actions.md §2). Null only pre-hydration.
    self: {
      userId: accountUserId ?? (hydrated ? selfParticipant.id : null),
      name: accountDisplayName ?? (hydrated ? selfParticipant.name : null),
    },
    notify: (input) => {
      if (!accountUserId || !projectId) return;
      void apiNotifyActionAssigned(accountUserId, projectId, {
        teamId: input.teamId,
        assigneeUserId: input.assigneeUserId,
        assigneeMemberId: input.assigneeMemberId,
        actionName: input.actionName,
        ...(input.description ? { description: input.description } : {}),
        email: input.email,
        tabId: input.tabId,
        elementId: input.elementId,
      }).catch(() => {});
    },
  });

  // Action rows (open AND done — the panel filters between Outstanding
  // and Completed) for the floating Actions panel (docs/specs/012-collaboration/assigned-actions.md), the
  // commentRows sibling: same memo key, same boxed-only walk. Rows
  // assigned to the current user sort first.
  const actionRows = useMemo(() => {
    const boxed: BoxedElement[] = activeTab.elements.filter((el): el is BoxedElement =>
      isBoxed(el),
    );
    return actionRowsFromElements(boxed, accountUserId ?? selfParticipant.id);
  }, [activeTab.elements, accountUserId, selfParticipant.id]);

  // The visitor name prompt drives the chrome hide rule (palette / explorer / dock / tab bar all suppressed so the
  // visitor's focus is on it). Gated on `hydrated` so it only shows once the post-mount useLayoutEffect has replaced
  // the placeholder participant with the loaded / freshly minted one; otherwise IdentityPrompt's
  // `useState(participant.name)` would capture the SSG placeholder "Guest".
  //
  // Join screen for visitors landing on an existing project who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not project
  // edit), so a viewer can confirm a name without any 403.
  //
  // Embeds skip the prompt entirely (docs/specs/013-workspace/embeds.md): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode &&
    !workbenchMode &&
    hydrated &&
    loadedExistingProject &&
    !nameConfirmed &&
    identityPromptOpen;
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-project welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;
  return {
    actionPopoverOpenId,
    actionRows,
    agentFocusByElement,
    anyWelcomeOpen,
    assignActionFor,
    assignActionId,
    closeActionPopover,
    closeAssignActionDialog,
    commentRows,
    completeAction,
    deleteAction,
    identityOnlyScreenOpen,
    lockedByOther,
    openActionPopover,
    openAssignAction,
    openAssignActionDialog,
    participantsByTab,
    peerRows,
    remoteSelectionsByElement,
    reopenAction,
    saveAction,
    wontDoAction,
  };
}

export type EditorCommentsSlice = ReturnType<typeof useEditorComments>;
