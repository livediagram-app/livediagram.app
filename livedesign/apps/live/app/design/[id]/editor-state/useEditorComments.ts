import { useMemo } from 'react';
import { isBoxed, elementActions, type BoxedElement } from '@livedesign/design';
import { apiNotifyActionAssigned } from '@/lib/api-client';
import {
  actionRowsFromElements,
  commentRowsFromElements,
} from '@/components/panels/CollaboratePanel';
import { useEditorActions } from '@/hooks/collab/useEditorActions';
import { usePresenceRows } from '../usePresenceRows';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';

// What the collaborate surfaces read: the presence rows (avatars, cursors, laser trails, selections, locks), the
// comment rows, the assigned actions and their rows, and the visitor's join screen gate.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorComments({
  documentSlice,
  selectionSlice,
  toolsSlice,
  sessionSlice,
  collaborationSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
}) {
  const {
    embedMode,
    workbenchMode,
    accountUserId,
    accountDisplayName,
    tabs,
    tickTabs,
    nameConfirmed,
    loadedExistingDesign,
  } = documentSlice;
  const { activeId, identityPromptOpen } = selectionSlice;
  const { laserPen } = toolsSlice;
  const {
    selfParticipant,
    designShareable,
    designTeamId,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteSelections,
    remoteCursors,
    remoteLaserTrails,
    designId,
    hydrated,
  } = sessionSlice;
  const { activeTab, localLaserTrail } = collaborationSlice;
  // Derived realtime presence rows (avatars per tab, remote cursors,
  // laser trails, per-element selections) and the concurrent-selection
  // lock (docs/specs/007-editor/live-app.md). Pure derivation over the usePresenceState values +
  // the local laser trail. See usePresenceRows.
  const {
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
  } = usePresenceRows({
    designShareable,
    designTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
    selfLaserConfig: laserPen.config,
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
  // re-verifies team membership + design access server-side.
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
    getAction: (elementId, actionId) => {
      const el = activeTab.elements.find((e) => e.id === elementId);
      if (!el || !isBoxed(el)) return undefined;
      const list = elementActions(el);
      return actionId ? list.find((a) => a.id === actionId) : list[0];
    },
    // The signed-in account, or the hydrated guest participant identity
    // (guests may self-assign, docs/specs/012-collaboration/assigned-actions.md §2). Null only pre-hydration.
    self: {
      userId: accountUserId ?? (hydrated ? selfParticipant.id : null),
      name: accountDisplayName ?? (hydrated ? selfParticipant.name : null),
    },
    notify: (input) => {
      if (!accountUserId || !designId) return;
      void apiNotifyActionAssigned(accountUserId, designId, {
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
  // Join screen for visitors landing on an existing design who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not design
  // edit), so a viewer can confirm a name without any 403.
  //
  // Embeds skip the prompt entirely (docs/specs/013-workspace/embeds.md): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode &&
    !workbenchMode &&
    hydrated &&
    loadedExistingDesign &&
    !nameConfirmed &&
    identityPromptOpen;
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-design welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;

  return {
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
    commentRows,
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
    actionRows,
    identityOnlyScreenOpen,
    anyWelcomeOpen,
  };
}

export type EditorComments = ReturnType<typeof useEditorComments>;
