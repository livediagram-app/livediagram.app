// The Canvas's comment and action props (docs/specs/012-collaboration/comment-pin.md, action-panel.md,
// assigned-actions.md): the Comment and Action panels' actions, the Collaborate panel's rows and its jumps to a card.
// Split from EditorCanvasHost, which spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { isBoxed, threadAt } from '@liveplanner/project';
import { commentPersisters } from '@/lib/comment-persistence';
import { focusSheetCell } from '@/hooks/sheets/sheet-cell-refs';

export function useCanvasThreadProps(): Pick<
  CanvasProps,
  | 'commentSelfId'
  | 'commentPanelActions'
  | 'actionSelfId'
  | 'actionPanelActions'
  | 'commentRows'
  | 'commentsPanelPosition'
  | 'onMoveCommentsPanel'
  | 'onResetCommentsPanel'
  | 'onOpenCommentsForElement'
  | 'actionRows'
  | 'onOpenActionForElement'
  | 'onToggleActionDone'
> {
  const {
    accountUserId,
    actionRows,
    commentRows,
    commentsPanelPosition,
    isReadOnly,
    can,
    openActionPopover,
    openAssignActionDialog,
    completeAction,
    reopenAction,
    linkedActions,
    openComments,
    selfParticipant,
    addComment,
    deleteComment,
    resolveThread,
    unresolveThread,
    setCommentsPanelPosition,
    setSelectedId,
    activeTab,
    scrollIntoView,
    projectId,
    sessionShareCode,
  } = useEditorContext();
  // The Collaborate panel's jump to a conversation card (docs/specs/012-collaboration/assigned-actions.md §5):
  // true when the row's element is that kind of card, now centred in view.
  const jumpToCard = (id: string, shape: 'comment-pin' | 'action-card'): boolean => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape' || el.shape !== shape) return false;
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    return true;
  };
  // How a comment change made on a Comment panel is kept: shared with the anchored popover.
  const commentPersist = commentPersisters({
    readOnly: isReadOnly,
    projectId,
    tabId: activeTab.id,
    selfId: selfParticipant.id,
    shareCode: sessionShareCode,
  });
  const threadOn = (elementId: string) => {
    const el = activeTab.elements.find((e) => e.id === elementId);
    return el && isBoxed(el) ? threadAt(el) : undefined;
  };
  return {
    // Comment panels (docs/specs/012-collaboration/comment-pin.md) drive the SAME thread machinery the anchored
    // popover does: it is all keyed by element id already.
    commentSelfId: selfParticipant.id,
    // Commenting is a Participant's too (docs/specs/013-workspace/share-roles.md); a Viewer only reads.
    commentPanelActions: !can.takePart
      ? undefined
      : {
          // A Participant has no autosave: its panel changes go through the comment endpoints, as the
          // popover's do (lib/comment-persistence.ts); an Editor's ride the room and its save.
          add: (id, text, mentions) =>
            addComment(id, text, commentPersist.add(id, text, mentions), mentions),
          remove: (id, cid) => deleteComment(id, cid, commentPersist.remove(cid)),
          resolve: (id) => resolveThread(id, commentPersist.threadState(threadOn(id), true)),
          unresolve: (id) => unresolveThread(id, commentPersist.threadState(threadOn(id), false)),
        },
    // Action panels (docs/specs/012-collaboration/action-panel.md) drive the SAME action machinery the popover
    // and the Assign Action dialog do. The viewer identity is the one the
    // popover uses: the account, else the guest participant.
    actionSelfId: accountUserId ?? selfParticipant.id,
    actionPanelActions: isReadOnly
      ? undefined
      : {
          configure: openAssignActionDialog,
          complete: completeAction,
          reopen: reopenAction,
          ...(linkedActions.openOnBoard ? { openBoard: () => linkedActions.openOnBoard?.() } : {}),
        },
    commentRows,
    commentsPanelPosition,
    onMoveCommentsPanel: (x, y) => setCommentsPanelPosition({ x, y }),
    onResetCommentsPanel: () => setCommentsPanelPosition(null),
    onOpenCommentsForElement: (id, cell) => {
      setSelectedId(id);
      // A Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"): its cell selected, so the
      // popover sits beside it.
      if (cell !== undefined) {
        focusSheetCell(id, cell);
        return openComments(id, cell);
      }
      // A Comment panel IS the thread (docs/specs/012-collaboration/assigned-actions.md §5): go to it
      // rather than open a popover repeating it beside the card.
      if (!jumpToCard(id, 'comment-pin')) openComments(id);
    },
    actionRows,
    onOpenActionForElement: (id) => {
      setSelectedId(id);
      // An Action panel IS the action: the same jump.
      if (!jumpToCard(id, 'action-card')) openActionPopover(id);
    },
    onToggleActionDone: isReadOnly
      ? undefined
      : (id, done, actionId) => (done ? completeAction(id, actionId) : reopenAction(id, actionId)),
  };
}
