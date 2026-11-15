// A card removal the server held because it would take too many cards off a board at once (docs/specs/007-editor/
// offline-changes.md "Held for review"; docs/specs/012-collaboration/realtime-conflict-resolution.md "Mass card
// removals"). Such a refusal is kept in the queue, never taken back.

export const REMOVAL_HELD_CODE = 'removal_held';

/** Whether a failed write was held as a mass removal. */
export function isRemovalHeld(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === REMOVAL_HELD_CODE;
}

export type HeldReason = 'over-threshold' | 'empties-board';

// Why a change was held, kept with it for the Needs Review banner: the server's reason and board, and the titles the
// named cards had when it was held.
export type HeldWhy = { reason?: HeldReason; board?: string; titles?: string[] };

// A title is cut to this many characters before it is kept with the change (it is stored, and counts to the bounds).
export const HELD_TITLE_MAX = 80;

const isReason = (v: unknown): v is HeldReason => v === 'over-threshold' || v === 'empties-board';

/** The reason and board a `removal_held` refusal named (on the error, from its body), or none. */
export function heldWhyOf(e: unknown): HeldWhy {
  const c = (e ?? {}) as { reason?: unknown; board?: unknown };
  return {
    ...(isReason(c.reason) ? { reason: c.reason } : {}),
    ...(typeof c.board === 'string' && c.board ? { board: c.board } : {}),
  };
}

/** A `why` read back from storage, or none when it is not of that shape. */
export function heldWhyOfStored(raw: unknown): HeldWhy {
  if (!raw || typeof raw !== 'object') return {};
  const titles = (raw as { titles?: unknown }).titles;
  return {
    ...heldWhyOf(raw),
    ...(Array.isArray(titles) ? { titles: titles.filter((t) => typeof t === 'string') } : {}),
  };
}

/** The titles to keep with a held change. */
export function heldTitles(titles: readonly string[]): string[] {
  return titles.map((t) => (t.length > HELD_TITLE_MAX ? `${t.slice(0, HELD_TITLE_MAX - 1)}…` : t));
}

// The held cards of one board and reason, as the banner lists them.
export type HeldGroup = {
  board: string | null;
  reason: HeldReason | null;
  cards: number;
  titles: string[];
};

const cardsWord = (n: number) => (n === 1 ? '1 card' : `${n} cards`);

/** The banner's title, counting cards. */
export function heldTitle(count: number): string {
  return count === 1 ? '1 card was about to be removed' : `${count} cards were about to be removed`;
}

const NOTHING_GONE = 'so we paused it. Nothing is gone yet.';

/** The banner's one line of why: the board and reason when every held card shares one, else the plain line. */
export function heldReason(groups: readonly HeldGroup[]): string {
  const only = groups.length === 1 ? groups[0] : undefined;
  if (only?.board && only.reason === 'empties-board')
    return `That would empty ${only.board}, ${NOTHING_GONE}`;
  if (only?.board && only.reason === 'over-threshold')
    return `That’s more of ${only.board} than usual in one go, ${NOTHING_GONE}`;
  return `That’s more cards than usual in one go, ${NOTHING_GONE}`;
}

/** A group's heading in the list, when the list has more than one group. */
export function heldGroupHeading(group: HeldGroup): string {
  const board = group.board ?? 'A board';
  return group.reason === 'empties-board' ? `Would empty ${board}` : `From ${board}`;
}

/** The disclosure's label. */
export function heldToggleLabel(count: number, open: boolean): string {
  if (open) return count === 1 ? 'Hide the card' : 'Hide the cards';
  return count === 1 ? 'Show the card' : `Show the ${count} cards`;
}

export const keepLabel = (count: number) => (count === 1 ? 'Keep Card' : 'Keep Cards');
export const removeLabel = (count: number) =>
  count === 1 ? 'Remove 1 Card' : `Remove ${count} Cards`;
export const keptToast = (count: number) => `Kept ${cardsWord(count)}`;
export const removedToast = (count: number) => `Removed ${cardsWord(count)}`;

// The most titles a group lists before "and N more".
export const HELD_LIST_MAX = 8;

/** A group's rows: up to HELD_LIST_MAX titles ("Untitled card" for none), and how many more it holds. */
export function heldRows(group: HeldGroup): { titles: string[]; more: number } {
  const titles = group.titles.slice(0, HELD_LIST_MAX).map((t) => t.trim() || 'Untitled card');
  return { titles, more: group.cards - titles.length };
}

/** The row after a group's titles: "and 3 more", or the count alone when no title was kept (a single delete). */
export function heldMoreLabel(listed: number, more: number): string | null {
  if (more <= 0) return null;
  return listed > 0 ? `and ${more} more` : cardsWord(more);
}
