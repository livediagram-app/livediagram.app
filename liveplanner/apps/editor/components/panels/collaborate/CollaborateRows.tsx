'use client';

// liveplanner's binding of the Collaborate panel's rows (one copy in @liveworkspace/workbench,
// docs/specs/012-collaboration/assigned-actions.md §5): the action row as is, and a comment row named by its Sheet
// cell when it is a cell's thread.

import { CommentRowItem as SharedCommentRowItem } from '@liveworkspace/workbench/components/panels/collaborate/CollaborateRows';
import { useCellRef, useSheetTitle } from '@/hooks/sheets/sheet-cell-refs';
import type { CommentRow } from '@/components/panels/CollaboratePanel';

export { ActionRowItem } from '@liveworkspace/workbench/components/panels/collaborate/CollaborateRows';

export function CommentRowItem({
  row,
  index,
  onClick,
}: {
  row: CommentRow;
  index: number;
  onClick: () => void;
}) {
  const label = useCommentRowLabel(row);
  return <SharedCommentRowItem row={row} index={index} onClick={onClick} label={label} />;
}

// A row's name: its element's label, and for a Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments")
// the cell, `Budget!B4` once the Sheet is drawn, "(Deleted Cell)" when its row or column is gone; a Sheet not drawn
// yet is named by its element's label alone. A drawn Sheet's name is its stored title.
export function useCommentRowLabel(row: Pick<CommentRow, 'elementId' | 'cell' | 'label'>): string {
  const ref = useCellRef(row.elementId, row.cell);
  // A drawn Sheet goes by its stored title, as its toolbar and its Inbox rows name it.
  const label = useSheetTitle(row.elementId) ?? row.label;
  if (row.cell === undefined || ref === undefined) return label;
  if (ref === null) return `${label} (Deleted Cell)`;
  return `${label}!${ref}`;
}
