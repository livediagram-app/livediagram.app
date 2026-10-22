import type { ReactNode } from 'react';

// A control drawn over one cell (a filter arrow, a comment marker, a dropdown arrow) sits inside role="grid", which
// may own only rows (sheet-element.md "Keyboard and focus"). This gives it that cell's row and gridcell, by index.
// Neither wrapper is positioned or styled, so the control's own absolute placement is unchanged. A control that
// belongs to no one cell (the Add Rows footer, past the last row) leaves the indexes out.
export function SheetCellSlot({ r, c, children }: { r?: number; c?: number; children: ReactNode }) {
  return (
    <div role="row" aria-rowindex={r === undefined ? undefined : r + 1}>
      <div role="gridcell" aria-colindex={c === undefined ? undefined : c + 1}>
        {children}
      </div>
    </div>
  );
}
