'use client';

import { useContext, useMemo, useState } from 'react';
import type { Element, TableElement } from '@liveknowledge/document';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import {
  cellContrastProbes,
  textContrastProbes,
  type TextContrastProbe,
} from '@/lib/text-contrast-probe';
import { textGroundMemo } from '@/lib/text-ground-memo';

// A text colour picker's grounds (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one probe for each of `els` whose ground can be judged, worked out only while its picker is
// open, so a closed menu never walks the tab. Each ground is memoised on what makes it (textGroundMemo),
// so a hover's live preview, which changes only the text colour, reuses it. Undefined outside the editor
// or where nothing can be judged.
export function useTextContrast(
  els: readonly Element[],
  open: boolean,
): TextContrastProbe[] | undefined {
  const tab = useContext(EditorContext)?.activeTab;
  const surface = useCanvasSurface();
  const [memo] = useState(textGroundMemo);
  return useMemo(
    () => (open && tab ? textContrastProbes(els, tab, surface, memo) : undefined),
    [open, tab, els, surface, memo],
  );
}

/**
 * A table cell menu's grounds: one probe for each kind of cell selected (alike in ground, colour and size), worked out
 * only while its Text row's picker is open, on the table as stored. Undefined outside the editor or where nothing
 * can be judged.
 */
export function useCellTextContrast(
  table: TableElement,
  cells: readonly { r: number; c: number }[],
  open: boolean,
): TextContrastProbe[] | undefined {
  const tab = useContext(EditorContext)?.activeTab;
  const surface = useCanvasSurface();
  return useMemo(() => {
    if (!open || !tab) return undefined;
    const stored = tab.elements.find((el) => el.id === table.id);
    return stored?.type === 'table' ? cellContrastProbes(stored, cells, tab, surface) : undefined;
  }, [open, tab, table.id, cells, surface]);
}
