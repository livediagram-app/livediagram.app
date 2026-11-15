// A card removal the server held because it would take too many cards off a board at once (docs/specs/007-editor/
// offline-changes.md "Held for review"; docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card
// removals"). Such a refusal is kept in the queue, never taken back.

export const REMOVAL_HELD_CODE = 'removal_held';

/** Whether a failed write was held as a mass removal. */
export function isRemovalHeld(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === REMOVAL_HELD_CODE;
}

/** The Needs Review banner's line, counting cards; neutral between the two reasons (too many at once, or a board
 *  emptied), which the server's refusal code does not tell apart. */
export function heldCopy(count: number): string {
  return count === 1
    ? '1 card removal is held: it would take too many cards off a board, or empty it.'
    : `${count} card removals are held: they would take too many cards off a board, or empty it.`;
}
