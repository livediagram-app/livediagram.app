// The arrow keys steer by the screen (docs/specs/008-canvas/3d-view.md "Turning the camera"): with the 3D camera turned
// q quarters clockwise, the screen's up is the plan's west at 1, its south at 2 and its east at 3. The editor sets the
// turn; useAvatarKeys reads it. One value per page, as walk-guard's.

export type ArrowDir = 'up' | 'right' | 'down' | 'left';

const ORDER: readonly ArrowDir[] = ['up', 'right', 'down', 'left'];

let turn = 0;

export function setArrowTurn(quarters: number): void {
  turn = quarters;
}

/**
 * The screen direction a plan direction shows as, for the camera's turn (3d-view.md "Turning the camera"): a character
 * facing the plan's west faces up the screen when the camera has turned one quarter. planDir's inverse.
 */
export function screenDir(plan: ArrowDir, quarters: number): ArrowDir {
  const i = ORDER.indexOf(plan);
  return ORDER[(((i + quarters) % 4) + 4) % 4]!;
}

/** The plan direction a screen direction steers, for the camera's turn now (or `quarters`). */
export function planDir(screen: ArrowDir, quarters = turn): ArrowDir {
  const i = ORDER.indexOf(screen);
  return ORDER[(((i - quarters) % 4) + 4) % 4]!;
}
