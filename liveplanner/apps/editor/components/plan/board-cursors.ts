// The pointer a Plan-mode board shows (docs/specs/026-plan/plan-board.md "Working on a board", Cursors): a hand only
// where a press picks something up. Out of Plan mode (`interactive` false) the board is an element like any other and
// takes the canvas's cursor.

// A card: the open hand to someone who may move it (an Editor, a Participant), a pointer to a Viewer, whose press
// opens it.
export function planCardCursor(interactive: boolean, canMoveCards: boolean): string | undefined {
  if (!interactive) return undefined;
  return canMoveCards ? 'grab' : 'pointer';
}

// The board's body between the cards: a press there never pans the canvas or moves the board (keepBoardPress), so it
// shows the arrow rather than inheriting the canvas's hand.
export function planBoardBodyCursor(interactive: boolean): string | undefined {
  return interactive ? 'default' : undefined;
}
