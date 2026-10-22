'use client';

// The cell menu's Comment row (docs/specs/029-sheets/sheet.md "Cell comments"): Insert Comment on a cell without a
// thread, Show Comments on one with one, opening the editor's thread popover beside the active cell. A Viewer reads
// a thread that is there and starts none.
import { MenuActionRow } from '@/components/primitives/PortalMenu';
import { CommentMenuIcon } from '@/components/palette/context-menu-icons';
import { useSheetCellThreads, useSheetComments } from '@/hooks/sheets/sheet-comments-context';
import { useSheetController } from './sheet-controller';
import { threadCellAt } from './SheetCellComments';

export function SheetCellCommentRow({ onDone }: { onDone: () => void }) {
  const c = useSheetController();
  const comments = useSheetComments();
  const own = useSheetCellThreads();
  if (!comments || !own) return null;
  const { r, c: col } = c.selection.active;
  const cell = threadCellAt(c, r, col);
  if (!cell) return null;
  const has = (own.threads?.[cell]?.comments.length ?? 0) > 0;
  if (!has && !comments.canComment) return null;
  return (
    <MenuActionRow
      plain
      label={has ? 'Show Comments' : 'Insert Comment'}
      icon={<CommentMenuIcon />}
      onClick={() => {
        comments.open(own.elementId, cell);
        onDone();
      }}
    />
  );
}
