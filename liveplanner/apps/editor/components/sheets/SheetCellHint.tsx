'use client';

// The hint under a hovered cell (docs/specs/029-sheets/sheet.md "Errors", "Links"): why its value is an error, or
// the link it holds and how to open it. Hung from the cell's left edge, so a cell near the right of a phone slides it
// left, and one near the foot of the screen flips it above the cell: @liveworkspace/ui's useKeepOnScreen, measured
// once per hovered cell, never per pointer move.
import { useRef } from 'react';
import { OVERLAY_MAX_WIDTH, onScreenTranslate, useKeepOnScreen } from '@liveplanner/ui';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';

// The gap between the cell's foot and the hint (px).
export const CELL_GAP = 2;

export function SheetCellHint({
  left,
  top,
  cellHeight,
  error,
  link,
}: {
  left: number;
  // The hint's top, just under the cell; the cell's height says where its top is, for the flip.
  top: number;
  cellHeight: number;
  error: string | null | undefined;
  link: string | null | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const slide = onScreenTranslate(
    useKeepOnScreen(ref, `${left}:${top}`, {
      anchor: () => {
        const r = ref.current?.offsetParent?.getBoundingClientRect();
        // The cell's top and bottom on screen: the hint's offset parent places both.
        return r && { top: r.top + top - CELL_GAP - cellHeight, bottom: r.top + top - CELL_GAP };
      },
    }),
  );
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-[10] rounded-md bg-slate-800 px-2 py-1 text-[11px] text-white shadow"
      style={{ left, top, maxWidth: `min(16rem, ${OVERLAY_MAX_WIDTH})`, transform: slide }}
    >
      {error ?? (
        <>
          <span className="block truncate">{link}</span>
          <span className="block text-slate-300">{`${keyLabel('Mod-Click')} to open`}</span>
        </>
      )}
    </div>
  );
}
