// The arrow keys among a start's cards (docs/specs/007-editor/start-diagramming.md "Keyboard"): Left and Right to the
// card before and after in reading order (across a section's end into the next), Up and Down to the nearest card in the
// row above and below, Home and End to the first and last. Pure over the cards' boxes, so the grid's column count (one
// on a phone, three on a wide panel) never needs knowing.

export type CardBox = { left: number; top: number; width: number; height: number };

export const START_CARD_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const;
type StartCardKey = (typeof START_CARD_KEYS)[number];

export const isStartCardKey = (key: string): key is StartCardKey =>
  (START_CARD_KEYS as readonly string[]).includes(key);

/** The index of the card a key moves to from card `from` among `boxes` (in reading order), or null where it leaves
 *  the cards: Up from the first row, Down from the last, Left from the first card, Right from the last. */
export function nextCardIndex(
  key: StartCardKey,
  from: number,
  boxes: readonly CardBox[],
): number | null {
  const last = boxes.length - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key === 'ArrowLeft') return from > 0 ? from - 1 : null;
  if (key === 'ArrowRight') return from < last ? from + 1 : null;
  const here = boxes[from]!;
  const middle = (b: CardBox) => b.left + b.width / 2;
  const down = key === 'ArrowDown';
  // The nearest row in that direction: the cards whose top is past this one's, the closest top among them.
  let rowTop: number | null = null;
  for (const b of boxes) {
    const past = down ? b.top > here.top + here.height / 2 : b.top + b.height / 2 < here.top;
    if (past && (rowTop === null || (down ? b.top < rowTop : b.top > rowTop))) rowTop = b.top;
  }
  if (rowTop === null) return null;
  const row = rowTop;
  // In that row, the card whose middle is nearest this one's.
  let best: number | null = null;
  boxes.forEach((b, i) => {
    if (Math.abs(b.top - row) > 1) return;
    if (
      best === null ||
      Math.abs(middle(b) - middle(here)) < Math.abs(middle(boxes[best]!) - middle(here))
    )
      best = i;
  });
  return best;
}
