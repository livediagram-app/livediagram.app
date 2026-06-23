// Per-cell table links (spec/09), lifted out of useEditorState.
// Tracks which cell's link picker is open (null = closed); the shared
// LinkPickerDialog renders against it in EditorView and applyCellLink
// writes the chosen link into that cell's style via setCellStyle
// (history-committed; null clears it).

import { useState } from 'react';
import { setCellStyle, type Element, type ElementLink } from '@livediagram/diagram';

type CellLinkPickerDeps = {
  // Locked tab or view-only session: no cell-link mutations may land.
  editsBlocked: boolean;
  // The history-aware element mutator. Cell-link writes push a
  // snapshot, same as any other element-field change.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
};

export function useCellLinkPicker(deps: CellLinkPickerDeps) {
  const { editsBlocked, commit } = deps;
  const [cellLinkPickerOpenFor, setCellLinkPickerOpenFor] = useState<{
    tableId: string;
    r: number;
    c: number;
  } | null>(null);
  const openCellLinkPicker = (tableId: string, r: number, c: number) => {
    if (editsBlocked) return;
    setCellLinkPickerOpenFor({ tableId, r, c });
  };
  const applyCellLink = (link: ElementLink | null) => {
    const target = cellLinkPickerOpenFor;
    if (!target || editsBlocked) return;
    commit((els) =>
      els.map((e) =>
        e.id === target.tableId && e.type === 'table'
          ? setCellStyle(e, target.r, target.c, { link: link ?? undefined })
          : e,
      ),
    );
  };
  return { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink };
}
