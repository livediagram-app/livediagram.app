// The bottom-right cluster's row with the Call dock in it (docs/specs/008-canvas/avatar-mode.md "The Call dock",
// "Where"; owner, 2026-11-07, Work Tracker #642, for a phone; Work Tracker 1041, at every width): the dock sits on the
// zoom buttons' bottom line rather than a row above them or floating over the canvas on its own. The row is three columns: the dock in the middle one, centred on the screen while there is room,
// and the cluster's buttons, unwrapped, in the right one. A `1fr` column never gets less than its content needs, so
// when the buttons need more than half of what the dock leaves, the left column gives up the difference and the dock
// moves left: it never covers a button.

/** The cluster row's layout classes, and its buttons' wrapper's, with the dock in the row or not, lifted or not. */
export function clusterRowLayout(
  dockInRow: boolean,
  lifted = false,
): { row: string; buttons: string } {
  return dockInRow
    ? {
        // The left column is at least `--call-dock-clear` wide: what the bottom-left panels (the Map) take, so the
        // dock never stands over them (Work Tracker 1041).
        row: 'left-4 grid grid-cols-[minmax(var(--call-dock-clear,0px),1fr)_auto_1fr] items-end gap-1.5',
        buttons: `col-start-3 ${lifted ? 'row-start-2' : 'row-start-1'} flex items-center justify-end gap-1.5`,
      }
    : {
        // The cluster as it has always been: one flex row, wrapping from the right on a narrow phone. The buttons'
        // wrapper takes no box of its own.
        row: 'flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5',
        buttons: 'contents',
      };
}

/** The row's gap between its columns (`gap-1.5`), and the room kept between the bottom-left panels and the dock. */
export const CALL_DOCK_ROW_GAP = 6;
export const CALL_DOCK_PANEL_GAP = 8;

/**
 * Where the dock goes beside the bottom-left panels (Work Tracker 1041): `clear` is the left column's least width, in
 * the row's own px, so the dock starts past the panels' right edge; `lifted` when the panels, the dock and the buttons
 * cannot share the bottom line, so the dock stands on a line of its own above the buttons, at the right. Every width is
 * on screen, in px; `scale` is the row's UI scale (its px per screen px).
 */
export function callDockRowFit(m: {
  rowLeft: number;
  rowWidth: number;
  // The bottom-left panels' right edge, or null with none beside the row.
  panelsRight: number | null;
  dockWidth: number;
  buttonsWidth: number;
  scale: number;
}): { clear: number; lifted: boolean } {
  const clear =
    m.panelsRight === null
      ? 0
      : Math.max(0, Math.ceil((m.panelsRight + CALL_DOCK_PANEL_GAP - m.rowLeft) / m.scale));
  const need = clear + (m.dockWidth + m.buttonsWidth) / m.scale + 2 * CALL_DOCK_ROW_GAP;
  return { clear, lifted: need > m.rowWidth / m.scale + 0.5 };
}
