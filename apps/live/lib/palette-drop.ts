// One gesture, one note.
//
// Clicking a palette tile ARMS it: the next click on the canvas draws that
// thing. Dragging the tile onto the canvas draws it too — and used to leave
// the tile still armed afterwards, so the next click anywhere on the board
// silently minted a second note. The drag already did what the arming was for,
// so landing a palette drag disarms it.
//
// A function rather than two calls at the wiring point, because "these two
// always happen together" is the whole rule and it deserves a name.
export function dropThenDisarm<Args extends unknown[]>(
  drop: (...args: Args) => void,
  disarm: () => void,
): (...args: Args) => void {
  return (...args: Args) => {
    try {
      drop(...args);
    } finally {
      // Even if the drop refused (a locked tab, a blocked layer): the tile was
      // armed by a gesture that is now over either way, and an armed tile the
      // author has forgotten about is the surprise being fixed here.
      disarm();
    }
  };
}
