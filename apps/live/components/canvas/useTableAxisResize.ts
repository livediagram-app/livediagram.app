import { useEffect, useRef, useState, type RefObject } from 'react';
import type { TableElement } from '@livediagram/diagram';

// Column / row divider resizing for TableView (spec/09 Table): the
// rest-to-arm dividers, the live track overrides while a drag is in
// flight, and the commit of pinned sizes on release. Extracted from
// TableView as a cohesive slice — everything about dragging a divider
// lives here; the view only wires the handlers onto its divider strips
// and feeds the live overrides into its grid templates.

const MIN_COL_PX = 30;
const MIN_ROW_PX = 24;

// A divider becomes draggable (and shows its line) only once the pointer
// has rested on it for this long — instantly interactive strips on every
// cell border kept swallowing clicks and flashing resize cursors mid-edit.
const RESIZE_ARM_MS = 400;

export function useTableAxisResize({
  element,
  rows,
  cols,
  gridRef,
  enabled,
  onCommitTable,
}: {
  element: TableElement;
  rows: number;
  cols: number;
  // The rendered grid — computed styles supply the live track sizes.
  gridRef: RefObject<HTMLDivElement | null>;
  // False for read-only / unselected views: dividers neither arm nor drag.
  enabled: boolean;
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'colWidths' | 'rowHeights'>>,
  ) => void;
}) {
  // Live sizes while dragging a divider (committed on release).
  const [resizeWidths, setResizeWidths] = useState<(number | null)[] | null>(null);
  const [resizeHeights, setResizeHeights] = useState<(number | null)[] | null>(null);
  const dragRef = useRef<(number | null)[] | null>(null);
  const dragRowRef = useRef<(number | null)[] | null>(null);

  // Resize dividers arm only after a deliberate hover (spec/09); leaving
  // disarms. See RESIZE_ARM_MS above.
  const [armedResize, setArmedResize] = useState<{ axis: 'col' | 'row'; index: number } | null>(
    null,
  );
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armResizeEnter = (axis: 'col' | 'row', index: number) => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => setArmedResize({ axis, index }), RESIZE_ARM_MS);
  };
  const armResizeLeave = () => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = null;
    setArmedResize(null);
  };
  useEffect(
    () => () => {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    },
    [],
  );

  const startAxisResize = (axis: 'col' | 'row') => (index: number) => (e: React.PointerEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const isCol = axis === 'col';
    const elemSize = isCol ? element.width : element.height;
    const rectSize = isCol ? rect.width : rect.height;
    const scale = elemSize > 0 ? rectSize / elemSize : 1;
    const count = isCol ? cols : rows;
    const tracks = getComputedStyle(grid)
      [isCol ? 'gridTemplateColumns' : 'gridTemplateRows'].split(' ')
      .map((t) => parseFloat(t));
    const baseSizes = isCol ? element.colWidths : element.rowHeights;
    const base: (number | null)[] = Array.from({ length: count }, (_, i) => baseSizes?.[i] ?? null);
    // Computed-style track sizes are already element-space px (ancestor
    // transforms don't reach computed style), so they must NOT be divided
    // by the render scale — only the rect-derived fallback is screen-space.
    const startSizeElem = Number.isFinite(tracks[index]!)
      ? tracks[index]!
      : rectSize / count / scale;
    const startPos = isCol ? e.clientX : e.clientY;
    const minPx = isCol ? MIN_COL_PX : MIN_ROW_PX;
    const ref = isCol ? dragRef : dragRowRef;
    const setResize = isCol ? setResizeWidths : setResizeHeights;
    const onMove = (ev: PointerEvent) => {
      const delta = ((isCol ? ev.clientX : ev.clientY) - startPos) / scale;
      const next = [...base];
      next[index] = Math.max(minPx, Math.round(startSizeElem + delta));
      ref.current = next;
      setResize(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (ref.current) {
        if (isCol) onCommitTable(element.id, { colWidths: ref.current });
        else onCommitTable(element.id, { rowHeights: ref.current });
      }
      ref.current = null;
      setResize(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return {
    resizeWidths,
    resizeHeights,
    armedResize,
    armResizeEnter,
    armResizeLeave,
    startColResize: startAxisResize('col'),
    startRowResize: startAxisResize('row'),
  };
}
