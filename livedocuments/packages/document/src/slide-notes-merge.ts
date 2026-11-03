// Two people writing speaker note cards at once (docs/specs/012-collaboration/speaker-note-cards.md "Two people
// writing at once"): a deck save is merged with the stored deck card by card, by card id, against the deck the saving
// editor built on, so another person's cards are never overwritten by an older copy. Pure.
import type { Deck, Slide, StoredPresentation } from './slide-deck';
import { NOTE_CARDS_MAX, slideNoteCards, withNoteCards, type NoteCard } from './slide-notes';

const byId = (cards: readonly NoteCard[]) => new Map(cards.map((c) => [c.id, c]));

/**
 * One slide's cards merged by id: `mine` is the saving editor's list, `base` the list it built on, `theirs` the
 * stored list. A card `mine` changed (or added) keeps `mine`'s text; one it left as in `base` takes `theirs`' (and
 * goes when `theirs` removed it); one `mine` removed goes unless `theirs` changed it; one only `theirs` has follows its
 * nearest earlier neighbour in `theirs` that the result holds, else goes first. Order is `mine`'s.
 */
export function mergeNoteCards(
  base: readonly NoteCard[],
  mine: readonly NoteCard[],
  theirs: readonly NoteCard[],
): NoteCard[] {
  const baseOf = byId(base);
  const mineOf = byId(mine);
  const theirsOf = byId(theirs);
  const out: NoteCard[] = [];
  for (const card of mine) {
    const was = baseOf.get(card.id);
    const now = theirsOf.get(card.id);
    if (!was || was.text !== card.text) out.push(card);
    else if (now) out.push(now);
  }
  // Cards `theirs` holds that `mine` does not: added there, or removed here but changed there since.
  theirs.forEach((card, i) => {
    if (mineOf.has(card.id)) return;
    const was = baseOf.get(card.id);
    if (was && was.text === card.text) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const found = out.findIndex((c) => c.id === theirs[j]!.id);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, card);
  });
  return out.slice(0, NOTE_CARDS_MAX);
}

const sameCards = (a: readonly NoteCard[], b: readonly NoteCard[]) =>
  a.length === b.length && a.every((c, i) => c.id === b[i]!.id && c.text === b[i]!.text);

const slideIn = (deck: Deck | undefined, id: string): Slide | undefined =>
  deck?.slides.find((s) => s.id === id);

/**
 * The deck `mine` with each slide's note cards merged against `base` and `theirs` (decks by index, slides by id).
 * Everything else in the deck is `mine`'s; a slide whose merged cards are `mine`'s own is left as it is.
 */
export function mergePresentationNoteCards(
  mine: StoredPresentation,
  base: StoredPresentation | null,
  theirs: StoredPresentation | null,
): StoredPresentation {
  if (!theirs) return mine;
  return {
    decks: mine.decks.map((deck, d) => ({
      slides: deck.slides.map((slide) => {
        const stored = slideIn(theirs.decks[d], slide.id);
        if (!stored) return slide;
        const before = slideIn(base?.decks[d], slide.id);
        const own = slideNoteCards(slide);
        const merged = mergeNoteCards(
          before ? slideNoteCards(before) : [],
          own,
          slideNoteCards(stored),
        );
        return sameCards(merged, own) ? slide : withNoteCards(slide, merged);
      }),
    })),
  };
}
