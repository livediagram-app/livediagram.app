// The board grid's row heights (docs/specs/025-plan/plan-board.md "What the board shows"): the column
// heads, then per swimlane its label (when the board has swimlanes) and its cells. Every row sizes to
// its content, except the last open row of cells, which takes the board's spare height, so the
// columns run to the bottom of a board resized taller.
export function boardRowTemplate(
  laneKeys: readonly string[],
  withLanes: boolean,
  collapsed: ReadonlySet<string>,
): string {
  const rows: string[] = ['auto'];
  let lastCells = -1;
  for (const key of laneKeys) {
    if (withLanes) rows.push('auto');
    // A shut swimlane draws its label only.
    if (withLanes && collapsed.has(key)) continue;
    rows.push('auto');
    lastCells = rows.length - 1;
  }
  // The spare height goes to the last open row of cells; with every row shut, to an empty row after
  // them, so no head or label is ever stretched.
  if (lastCells > 0) rows[lastCells] = '1fr';
  else rows.push('1fr');
  return rows.join(' ');
}
