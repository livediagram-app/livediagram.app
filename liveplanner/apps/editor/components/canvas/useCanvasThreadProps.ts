// The Canvas's comment and action props (docs/specs/012-collaboration/action-panel.md, assigned-actions.md): the Action
// panel's actions, the Collaborate panel's rows and its jumps to a card or a Sheet cell. Comment threads on canvas
// elements are retired (docs/specs/026-plan/plan-mode.md "No comment thread on any canvas element"): a stored Comment
// panel reads its thread and drives nothing.
// Split from EditorCanvasHost, which spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { focusSheetCell } from '@/hooks/sheets/sheet-cell-refs';

export function useCanvasThreadProps(): Pick<
  CanvasProps,
  | 'commentSelfId'
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
    openActionPopover,
    openAssignActionDialog,
    completeAction,
    reopenAction,
    linkedActions,
    openComments,
    selfParticipant,
    setCommentsPanelPosition,
    setSelectedId,
    activeTab,
    scrollIntoView,
  } = useEditorContext();
  // The Collaborate panel's jump to a conversation card (docs/specs/012-collaboration/assigned-actions.md §5):
  // true when the row's element is that kind of card, now centred in view.
  const jumpToCard = (id: string, shape: 'action-card'): boolean => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape' || el.shape !== shape) return false;
    scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
    return true;
  };
  return {
    // A stored Comment panel's read-only thread puts my own comments on the right.
    commentSelfId: selfParticipant.id,
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
      // popover sits beside it. The panel lists no other thread (commentRowsFromElements), and an element's own
      // opens nothing.
      if (cell !== undefined) {
        focusSheetCell(id, cell);
        openComments(id, cell);
      }
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
