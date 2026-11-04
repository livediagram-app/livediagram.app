'use client';

// A cell's + Add card row, folding away while a drop gap shows in the cell (docs/specs/026-plan/plan-board.md "Add
// card steps aside"): its grid row closes from 1fr to 0fr and it fades, over the drop gap's 180 ms, and opens again once the gap
// leaves. Its own room and the cell's gap before it close together (a negative top margin of the cell's gap), so
// nothing above it moves and the cell loses exactly the row. Pure CSS on a prop the board already renders with: no
// state, no effect, no render of its own. Folded, it is inert (no press, no focus, hidden from assistive tech).
// Reduced motion folds it at once.
export function CellAddRow({
  folded,
  gap,
  children,
}: {
  folded: boolean;
  // The cell's own gap between its list and this row, in px, taken back while folded.
  gap: number;
  children: React.ReactNode;
}) {
  return (
    <div
      data-cell-add-row={folded ? 'folded' : 'shown'}
      inert={folded}
      // The drop gap's own length and easing (useGapMotion GAP_MOTION_MS, GAP_MOTION_EASE; a test keeps them equal), so
      // the gap closing and the row opening are one motion.
      className="grid transition-[grid-template-rows,opacity,margin-top] duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
      style={{
        gridTemplateRows: folded ? '0fr' : '1fr',
        opacity: folded ? 0 : 1,
        marginTop: folded ? -gap : 0,
      }}
    >
      {/* Always clipped, so the row grows into view with its room rather than showing whole before its room has
          opened; the clip margin leaves its focus outline uncut. */}
      <div className="min-h-0 [overflow-clip-margin:4px] [overflow:clip]">{children}</div>
    </div>
  );
}
