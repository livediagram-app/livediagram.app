// Where a menu opens beside the card it belongs to (docs/specs/013-workspace/explorer-home.md "Jump Back In"): out of
// the card's way, never over it. To the card's right with its top level with the card's, else to its left, else
// nowhere (null), and the caller hangs it from its trigger as usual. PURE, so it tests without layout.

// The px between the card's edge and the menu.
export const BESIDE_GAP = 8;

export function besideSpot(
  card: { left: number; right: number; top: number },
  menuWidth: number,
  viewportWidth: number,
  margin: number,
): { left: number; top: number } | null {
  if (card.right + BESIDE_GAP + menuWidth <= viewportWidth - margin) {
    return { left: card.right + BESIDE_GAP, top: card.top };
  }
  const left = card.left - BESIDE_GAP - menuWidth;
  if (left >= margin) return { left, top: card.top };
  return null;
}
