// The Canvas's comment and action props (docs/specs/012-collaboration/comment-pin.md, action-panel.md): the
// Comments panel's rows, place and jumps to an element, and the Actions rows with their done toggle, read from
// EditorContext. Split from EditorCanvasHost, which spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

export function useCanvasThreadProps(): Pick<
  CanvasProps,
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
    actionRows,
    commentRows,
    commentsPanelPosition,
    isReadOnly,
    openActionPopover,
    completeAction,
    reopenAction,
    openComments,
    setCommentsPanelPosition,
    setSelectedId,
  } = useEditorContext();
  return {
    commentRows: commentRows,
    commentsPanelPosition: commentsPanelPosition,
    onMoveCommentsPanel: (x, y) => setCommentsPanelPosition({ x, y }),
    onResetCommentsPanel: () => setCommentsPanelPosition(null),
    onOpenCommentsForElement: (id) => {
      setSelectedId(id);
      openComments(id);
    },
    actionRows: actionRows,
    onOpenActionForElement: (id) => {
      setSelectedId(id);
      openActionPopover(id);
    },
    onToggleActionDone: isReadOnly
      ? undefined
      : (id, done, actionId) => (done ? completeAction(id, actionId) : reopenAction(id, actionId)),
  };
}
