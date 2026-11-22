// The changed slides of a deck save, sent alone (docs/specs/012-collaboration/speaker-note-cards.md "Saving"): a page
// going with a deck too large to outlive it sends only the slides this editor changed, each with the cards it was
// built on, and the server merges each into the stored deck card by card. Making the patch (the editor), reading it
// and applying it (the api). Pure.
import { parseStoredPresentation, type Slide, type StoredPresentation } from './slide-deck';
import { slideWithMergedNoteCards } from './slide-notes-merge';
import { parseNoteCards, slideNoteCards, type NoteCard } from './slide-notes';

export type DeckSlidePatchEntry = {
  /** The slide as this editor has it. */
  slide: Slide;
  /** Its cards in the deck this editor built on: what the merge tells this editor's changes from another's by. */
  baseCards: NoteCard[];
  /** The slide before it in this editor's deck (null: it is first), where it goes if the stored deck lost it. */
  after: string | null;
};

export type DeckSlidePatch = { slides: DeckSlidePatchEntry[] };

const sameIds = (a: readonly Slide[], b: readonly Slide[]) =>
  a.length === b.length && a.every((s, i) => s.id === b[i]!.id);

/**
 * The slides `mine` changed from `base`, or null when a patch cannot say it: either has more than one deck, the
 * slides are not the same ones in the same order (one added, removed or moved), or nothing changed.
 */
export function deckSlidePatch(
  mine: StoredPresentation | null,
  base: StoredPresentation | null,
): DeckSlidePatch | null {
  if (!mine || !base || mine.decks.length !== 1 || base.decks.length !== 1) return null;
  const now = mine.decks[0]!.slides;
  const was = base.decks[0]!.slides;
  if (!sameIds(now, was)) return null;
  const slides: DeckSlidePatchEntry[] = [];
  now.forEach((slide, i) => {
    const before = was[i]!;
    if (JSON.stringify(slide) === JSON.stringify(before)) return;
    slides.push({
      slide,
      baseCards: [...slideNoteCards(before)],
      after: i > 0 ? now[i - 1]!.id : null,
    });
  });
  return slides.length > 0 ? { slides } : null;
}

// One slide as the deck parse reads it (parseStoredPresentation), or null when it is not one.
const parseSlide = (raw: unknown): Slide | null =>
  parseStoredPresentation({ decks: [{ slides: [raw] }] })?.decks[0]?.slides[0] ?? null;

/** A patch from the wire, or null when any part of it is not one (the whole save is refused, never half applied). */
export function parseDeckSlidePatch(raw: unknown): DeckSlidePatch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entries = (raw as Partial<DeckSlidePatch>).slides;
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const seen = new Set<string>();
  const slides: DeckSlidePatchEntry[] = [];
  for (const entry of entries as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { slide: rawSlide, baseCards, after } = entry as Partial<Record<string, unknown>>;
    const slide = parseSlide(rawSlide);
    if (!slide || seen.has(slide.id)) return null;
    if (!Array.isArray(baseCards)) return null;
    if (after !== null && (typeof after !== 'string' || after.length === 0)) return null;
    seen.add(slide.id);
    slides.push({ slide, baseCards: parseNoteCards(baseCards) ?? [], after });
  }
  return { slides };
}

/**
 * The stored deck with the patch applied (the first deck): each patched slide in place of the stored slide of its id,
 * its cards merged by card id; a slide the stored deck no longer holds goes after its `after` slide, else first, as
 * this editor has it (as a whole save would keep it). No stored deck starts one; other decks are left as they are.
 */
export function applyDeckSlidePatch(
  stored: StoredPresentation | null,
  patch: DeckSlidePatch,
): StoredPresentation {
  const decks = stored && stored.decks.length > 0 ? stored.decks : [{ slides: [] }];
  const slides = [...decks[0]!.slides];
  for (const { slide, baseCards, after } of patch.slides) {
    const at = slides.findIndex((s) => s.id === slide.id);
    if (at >= 0) {
      slides[at] = slideWithMergedNoteCards(slide, baseCards, slides[at]!);
      continue;
    }
    const prev = after === null ? -1 : slides.findIndex((s) => s.id === after);
    slides.splice(prev + 1, 0, slide);
  }
  return { decks: [{ slides }, ...decks.slice(1)] };
}
