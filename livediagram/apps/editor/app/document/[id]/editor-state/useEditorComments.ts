'use client';

import { useMemo, useRef } from 'react';
import {
  isBoxed,
  elementActions,
  type BoxedElement,
  type CommentMention,
} from '@livediagram/document';
import { useCommentMentions } from '@/hooks/collab/useCommentMentions';
import { useEditorComments as useCommentThreads } from '@/hooks/collab/useEditorComments';
import { useCommentReactionScope } from '@/hooks/collab/useCommentReactionScope';
import { apiNotifyActionAssigned } from '@/lib/api-client';
import { useTokenTeams } from '@/lib/explorer-host';
import {
  actionRowsFromElements,
  commentRowsFromElements,
} from '@/components/panels/CollaboratePanel';
import { useEditorActions } from '@/hooks/collab/useEditorActions';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';

// Comments, mentions, reactions and assigned actions, with the active tab they are read from. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorComments({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
}) {
  const {
    accountDisplayName,
    accountUserId,
    documentId,
    hydrated,
    selfParticipant,
    voteSelfId,
    workbenchMode,
  } = fromDocument;
  const { tabs, tickTabs } = fromHistory;
  const { activeId } = fromSelection;
  const { applyElementDelta, documentTeamId, participant, realtime } = fromCollaboration;
  // The mention notify (useCommentMentions, below): declared first because the
  // comments hook takes it before the teams it depends on exist.
  const mentionNotifyRef = useRef<(text: string, mentions: CommentMention[]) => void>(() => {});
  // Comment-thread state + handlers. The open-id drives the
  // dynamic <CommentThreadPopover> JSX gate further down; the
  // action callbacks bind to the selection popover + the popover
  // itself. Mutations bypass the history hook (no Ctrl+Z eats a
  // half-typed comment) and travel as deltas; see
  // apps/editor/hooks/collab/useEditorComments.ts.
  const {
    commentThreadOpenId,
    openComments,
    closeComments,
    addComment,
    replaceCommentId,
    deleteComment,
    resolveThread,
    unresolveThread,
  } = useCommentThreads({
    applyElementDelta,
    activeTabId: activeId,
    selfParticipant,
    // A Community visitor reads the board, never its conversation (docs/specs/025-community/community.md).
    commentsOff: realtime.sessionCommunity !== null,
    // Bound below, once the teams the mention list comes from have loaded.
    onMentioned: (text, mentions) => mentionNotifyRef.current(text, mentions),
  });

  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md), surfaced in the
  // search panel. Fetched lazily the first time search opens so
  // guest sessions and non-searching sessions never pay the request;
  // guests can't have teams, so the gate also requires an account id.
  // Signed-in only (guests can't have teams). Loaded for the whole
  // session, not just while search is open, because the floating
  // Explorer panel now surfaces teams + their documents (a Teams
  // accordion, team rows in Recent, the current team document —
  // docs/specs/013-workspace/team-shared-documents.md), so the data has to be present whenever the panel is.
  const teams = useTokenTeams(!!accountUserId && !workbenchMode);
  // Comment @-mentions (docs/specs/012-collaboration/comment-mentions.md): the document team's members as
  // candidates, and the notify a mentioning comment fires.
  const commentMentions = useCommentMentions({
    // A workbench reads no team and notifies no one.
    ownerId: workbenchMode ? null : (accountUserId ?? null),
    teams,
    documentTeamId,
    documentId,
  });
  useAssignRef(mentionNotifyRef, commentMentions.notifyMentioned);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  // Comment reactions (docs/specs/012-collaboration/comment-reactions.md): whoever may comment may react, under
  // the collab key their answers use; a Community visitor has no comments at all.
  const commentReactions = useCommentReactionScope({
    applyElementDelta,
    activeTab,
    selfKey: voteSelfId,
    selfName: selfParticipant.name,
    canReact: participant.can.takePart && realtime.sessionCommunity === null,
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
  // re-verifies team membership + document access server-side.
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
      if (!accountUserId || !documentId) return;
      void apiNotifyActionAssigned(accountUserId, input.teamId, {
        assigneeUserId: input.assigneeUserId,
        assigneeMemberId: input.assigneeMemberId,
        documentId,
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
  return {
    activeTab,
    openActionPopover,
    openComments,
    view: {
      activeTab,
      addComment,
      replaceCommentId,
      closeComments,
      commentRows,
      commentThreadOpenId,
      deleteComment,
      commentMentions,
      commentReactions,
      openComments,
      resolveThread,
      actionPopoverOpenId,
      actionRows,
      assignActionFor,
      assignActionId,
      closeActionPopover,
      closeAssignActionDialog,
      completeAction,
      deleteAction,
      openActionPopover,
      openAssignAction,
      openAssignActionDialog,
      reopenAction,
      wontDoAction,
      saveAction,
      teams,
      unresolveThread,
    },
  };
}

export type EditorCommentsSlice = ReturnType<typeof useEditorComments>;
