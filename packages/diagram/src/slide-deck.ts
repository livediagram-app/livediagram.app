// Slide decks (spec/31): the data model and the pure helpers a presentation
// is built from.
//
// A slide is an explicit, ordered set of elements you chose, FROM ONE TAB. The
// DECK is what spans tabs: slide 1 can come from Tab A, slide 2 from Tab C,
// slide 3 from Tab A again. Keeping a slide inside one tab is what makes it
// well-defined, because elements on different tabs share no coordinate space
// and no backdrop, so "fit this slide" would have no meaning across them.
//
// Slides reference elements, they never copy them. That is what keeps a deck
// in step with the diagram it presents: edit a shape and every slide it is on
// shows the new version, because no slide ever held the old one. It also makes
// the delete case correct for free (see resolveSlide).
//
// Everything here is pure — `(Deck, Tab[]) -> ...` with no React — so the
// editor, the api and the MCP worker can all reach for the same answers.

import { contentBounds } from './svg-render';
import type { Element, ElementId, Tab, TabId } from './index';

export type Slide = {
  id: string;
  /** Shown in the panel and the presenter HUD. Absent = "Slide N". */
  name?: string;
  /** The one tab this slide draws from: its backdrop, theme and coordinates. */
  tabId: TabId;
  elementIds: ElementId[];
  /** What you mean to SAY over this slide. The slide's own, not any element's. */
  notes?: string;
  /**
   * Left out of the presentation without being deleted. Absent = shown, so a
   * deck written before this existed reads as all-visible.
   *
   * A separate idea from deleting: a slide you might want next week, a backup
   * detail for a question you may not get, a section you cut for time. Losing
   * the slide to get it out of the run is the wrong trade.
   */
  hidden?: boolean;
};

export type Deck = { slides: Slide[] };

// The stored envelope. An array from day one even though v1 ships exactly one
// deck: "the deck for the exec review" and "the deck for the team walkthrough"
// are an obvious want over one diagram, and shipping `{ slides }` would make
// the second one a data migration.
export type StoredPresentation = { decks: Deck[] };

/** A slide's display name: its own, or its 1-based position. */
export function slideName(slide: Slide, index: number): string {
  const trimmed = slide.name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Slide ${index + 1}`;
}

/**
 * The elements a slide shows, in the tab's own paint order.
 *
 * Unknown ids are SKIPPED rather than treated as an error, the same policy
 * spec/74 applies to an unknown `layerId`. That is what makes deleting an
 * element behave: the slide quietly shows the rest, and because the slide was
 * never rewritten, undoing the delete puts the element back on it. Cleaning up
 * references at delete time would look tidier and would lose deck structure to
 * a keystroke the user took back.
 *
 * Paint order comes from the TAB, not from `elementIds`: the slide decides
 * what is on it, the diagram decides what sits in front of what. Ordering by
 * the slide's list would let the order you happened to click things in
 * restack the drawing.
 */
export function resolveSlide(slide: Slide, tab: Tab | undefined): Element[] {
  if (!tab) return [];
  const wanted = new Set(slide.elementIds);
  if (wanted.size === 0) return [];
  const chosen = tab.elements.filter((el) => wanted.has(el.id));
  const present = new Set(chosen.map((el) => el.id));

  // Arrows come along. An arrow whose endpoints are both on the slide is
  // included even when it was not picked, so building a slide by marquee over
  // a cluster of boxes does not need every connector hand-added. An arrow
  // picked explicitly is already in `chosen` and stays whatever its ends do,
  // because the author asked for it.
  const implied = tab.elements.filter(
    (el) => el.type === 'arrow' && !present.has(el.id) && endpointsWithin(el, present),
  );
  if (implied.length === 0) return chosen;
  const all = new Set([...present, ...implied.map((el) => el.id)]);
  return tab.elements.filter((el) => all.has(el.id));
}

function endpointOn(end: { kind: string; elementId?: string; arrowId?: string }, ids: Set<string>) {
  if (end.kind === 'pinned') return end.elementId !== undefined && ids.has(end.elementId);
  if (end.kind === 'on-arrow') return end.arrowId !== undefined && ids.has(end.arrowId);
  // A free endpoint pins to nothing, so it can never tie an arrow to a slide.
  // 'pinned-group' names a group, not an element, and is left out for the same
  // reason: the slide holds elements, and inferring group membership here
  // would guess at an intent the author never expressed.
  return false;
}

function endpointsWithin(arrow: Element, ids: Set<string>): boolean {
  if (arrow.type !== 'arrow') return false;
  return endpointOn(arrow.from, ids) && endpointOn(arrow.to, ids);
}

/**
 * The rectangle a slide should be framed to, or null when it has nothing on it.
 *
 * A single frame element (spec/09) on the slide wins: a frame IS a bounded
 * region somebody drew deliberately, so an author who wants exact framing has
 * a way to say so with an element the product already has. Two or more frames
 * are ambiguous, so they fall back to the content bounds like anything else.
 */
export function slideBounds(
  elements: Element[],
): { x: number; y: number; w: number; h: number } | null {
  if (elements.length === 0) return null;
  const frames = elements.filter((el) => el.type === 'shape' && el.shape === 'frame');
  const only = frames.length === 1 ? frames[0] : undefined;
  if (only && only.type === 'shape') {
    return { x: only.x, y: only.y, w: only.width, h: only.height };
  }
  return contentBounds(elements);
}

/**
 * The slides that can actually be shown, paired with their tab.
 *
 * Slides the author has HIDDEN are left out, as is a slide whose tab is gone:
 * the tab may come back via undo, and a presentation that refuses to start
 * because one slide points at a deleted tab helps nobody. A slide whose ELEMENTS have all
 * gone is kept, because an empty slide you can see and fix beats a slide that
 * silently deleted itself when you cleared its contents.
 */
export function presentableSlides(
  deck: Deck,
  tabs: Tab[],
): { slide: Slide; tab: Tab; index: number }[] {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const out: { slide: Slide; tab: Tab; index: number }[] = [];
  deck.slides.forEach((slide, index) => {
    // Hidden slides are skipped here, which is the ONE place the run is
    // decided — so the count on the Present button, the `7 / 23` in the HUD
    // and what advancing lands on can never disagree about the deck's length.
    if (slide.hidden) return;
    const tab = byId.get(slide.tabId);
    if (tab) out.push({ slide, tab, index });
  });
  return out;
}

/** Every tab a deck reaches into — what Start must have loaded before it runs. */
export function deckTabIds(deck: Deck): Set<TabId> {
  return new Set(deck.slides.map((s) => s.tabId));
}

export const EMPTY_DECK: Deck = { slides: [] };

// --- Reading what was stored ------------------------------------------------
//
// The stored blob comes back from the api as text the client did not write in
// this session, so it is parsed defensively for the same reason the clipboard
// payload is: never throw, and drop what cannot be understood rather than
// failing the whole diagram load. A diagram whose deck is unreadable must
// still open.

function isSlide(value: unknown): value is Slide {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<Slide>;
  if (typeof s.id !== 'string' || s.id.length === 0) return false;
  if (typeof s.tabId !== 'string' || s.tabId.length === 0) return false;
  if (!Array.isArray(s.elementIds)) return false;
  if (!s.elementIds.every((id) => typeof id === 'string')) return false;
  if (s.name !== undefined && typeof s.name !== 'string') return false;
  if (s.notes !== undefined && typeof s.notes !== 'string') return false;
  if (s.hidden !== undefined && typeof s.hidden !== 'boolean') return false;
  return true;
}

/** Parse a stored presentation blob. Null when absent or unreadable. */
export function parseStoredPresentation(raw: unknown): StoredPresentation | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim().length === 0) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null) return null;
  const decks = (value as Partial<StoredPresentation>).decks;
  if (!Array.isArray(decks)) return null;
  const parsed: Deck[] = [];
  for (const deck of decks) {
    if (typeof deck !== 'object' || deck === null) continue;
    const slides = (deck as Partial<Deck>).slides;
    if (!Array.isArray(slides)) continue;
    parsed.push({ slides: slides.filter(isSlide) });
  }
  return { decks: parsed };
}

/**
 * The one deck v1 works with. The envelope holds an array so a second deck is
 * not a migration, but every surface today reads and writes the first.
 */
export function firstDeck(stored: StoredPresentation | null): Deck {
  return stored?.decks[0] ?? EMPTY_DECK;
}

/** The envelope to store for a single deck. Null when there is nothing to keep. */
export function storePresentation(deck: Deck): StoredPresentation | null {
  return deck.slides.length === 0 ? null : { decks: [deck] };
}
