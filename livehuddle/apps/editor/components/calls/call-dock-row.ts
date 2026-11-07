// The bottom-right cluster's row with the Call dock in it (docs/specs/008-canvas/avatar-mode.md "The Call dock",
// "Where"; owner, 2026-11-07, Work Tracker #642): on a phone the dock sits on the zoom buttons' bottom line rather than
// a row above them. The row is three columns: the dock in the middle one, centred on the screen while there is room,
// and the cluster's buttons, unwrapped, in the right one. A `1fr` column never gets less than its content needs, so
// when the buttons need more than half of what the dock leaves, the left column gives up the difference and the dock
// moves left: it never covers a button.

/** The cluster row's layout classes, and its buttons' wrapper's, with the dock in the row or not. */
export function clusterRowLayout(dockInRow: boolean): { row: string; buttons: string } {
  return dockInRow
    ? {
        row: 'left-4 grid grid-cols-[1fr_auto_1fr] items-end gap-1.5',
        buttons: 'col-start-3 row-start-1 flex items-center justify-end gap-1.5',
      }
    : {
        // The cluster as it has always been: one flex row, wrapping from the right on a narrow phone. The buttons'
        // wrapper takes no box of its own.
        row: 'flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5',
        buttons: 'contents',
      };
}
