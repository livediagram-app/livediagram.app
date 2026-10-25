'use client';

// The slide deck's state (docs/specs/012-collaboration/presentation-mode.md): the deck itself, the editing verbs the
// Slide Deck panel drives, and the presentation the Start button runs.
//
// The deck is document-level, not per-tab, because a slide belongs to one tab
// but the DECK does not: its order interleaves tabs freely (A, C, A), so no
// single tab can own the list. It rides the document-metadata save, not the
// per-tab element save.
//
// Slides hold element REFERENCES. Nothing here copies an element, which is
// what keeps a deck in step with the document it presents: edit a shape and
// every slide it is on shows the new version, because no slide ever held the
// old one. Deleting an element is handled the same way — by NOT handling it,
// so the slide simply resolves past the missing id and undo puts it back.

import { slideHeadlines } from '@/lib/slide-headline';
import { selectionIds, type Selection } from '@liveworkspace/workbench/lib/selection-store';

const idsOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deckFollowingPages,
  GoneSlides,
  EMPTY_DECK,
  firstDeck,
  pageMoveForDeckOrder,
  slidePageOwnSlideIds,
  pagesOf,
  pageLabel,
  parseStoredPresentation,
  presentableSlides,
  storePresentation,
  type Deck,
  type Slide,
  type Tab,
} from '@livedocuments/document';

import { track } from '@/lib/telemetry';
import { useSlideThumbnails } from '@/hooks/ui/useSlideThumbnails';
import {
  readPresentationConfig,
  withPresentationConfig,
  type PresentationConfig,
} from '@/lib/presentation-config';
import type { UserPreferences } from '@/lib/user-preferences';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { positionAt, presentingIndex, type PresentingPosition } from '@liveworkspace/workbench/lib/presenting-position';
import { loadPresentationOverlay } from '@/lib/editor-deferred-code';

// How long after the last deck edit the save fires. Deck edits arrive in
// bursts (drag a row through four positions, type a sentence of notes), and
// each one is a whole-document metadata PUT.
const DECK_SAVE_DEBOUNCE_MS = 900;

export type SlideDeckState = ReturnType<typeof useSlideDeck>;

/**
 * Every page slide's page label, read from the slide's OWN tab's pages so a slide on another tab
 * still names its page; null when that page (or its tab) no longer exists. Labelled as the page
 * picker labels them, so the row and the picker agree.
 */
export function pageSlideLabels(deck: Deck, tabs: readonly Tab[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const pagesByTab = new Map<string, ReturnType<typeof pagesOf>>();
  for (const slide of deck.slides) {
    if (!slide.pageId) continue;
    let pages = pagesByTab.get(slide.tabId);
    if (!pages) {
      const tab = tabs.find((t) => t.id === slide.tabId);
      pages = tab ? pagesOf(tab) : [];
      pagesByTab.set(slide.tabId, pages);
    }
    const at = pages.findIndex((p) => p.id === slide.pageId);
    out.set(slide.id, at < 0 ? null : pageLabel(pages[at]!, at, Math.max(2, pages.length)));
  }
  return out;
}

export function useSlideDeck({
  tabs,
  activeTabId,
  setActiveId,
  readSelection,
  setSelectedId,
  setMultiSelectedIds,
  isReadOnly,
  saveDeck,
  loadAllTabs,
  framePage,
  movePage,
  prefs,
  commitPrefs,
}: {
  // The person's preferences, where the presenter settings live, and how a change to them is written.
  prefs: UserPreferences;
  commitPrefs: (next: UserPreferences) => void;
  tabs: Tab[];
  activeTabId: string;
  setActiveId: (id: string) => void;
  // Read when a slide is made from the selection (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  isReadOnly: boolean;
  /** Persists the serialised deck (null clears it). Absent before hydration. */
  saveDeck?: (serialised: string | null) => void;
  /** Pulls every not-yet-loaded tab, so a deck can reach a tab nobody visited. */
  loadAllTabs?: () => Promise<unknown>;
  /** Frames a page of a tab in the view (as its label's press does), once that tab is
   *  the active one. Absent where nothing frames pages. */
  framePage?: (tabId: string, pageId: string) => void;
  /** Moves a tab's page to a unit index (pageMovedTo), for a page slide dragged in the deck: the deck follows the
   *  pages, so a drag there moves the page (docs/specs/007-editor/pages-mode.md "Slides"). */
  movePage?: (tabId: string, pageId: string, unitIndex: number) => void;
}) {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  // Which slide the PANEL has open. Separate from the presentation's own
  // index: checking slide 4 in the panel should not mean starting there.
  const [openSlideId, setOpenSlideId] = useState<string | null>(null);
  // Non-null only while presenting: the slide on screen, by id (@liveworkspace/workbench/lib/presenting-position.ts), so a peer's edit to the
  // deck or its tabs never moves the presenter to another slide.
  const [presenting, setPresenting] = useState<PresentingPosition | null>(null);
  const [startingDeck, setStartingDeck] = useState(false);
  // The presenter settings (docs/specs/012-collaboration/presentation-mode.md "Settings"), the person's own, following
  // their account in the preferences. Read here rather than in the overlay because the FIT reads them too: "Actual
  // size" is a setting about the camera, and the camera lives outside the overlay.
  const config = useMemo(() => readPresentationConfig(prefs), [prefs]);
  const prefsRef = useLatest(prefs);
  const commitRef = useLatest(commitPrefs);
  const updateConfig = useCallback(
    (patch: Partial<PresentationConfig>) => {
      // The FIELD, not the value: what we want to learn is which settings people
      // reach for at all. Values would multiply the vocabulary for no extra
      // signal, and the enum is deliberately closed.
      for (const field of Object.keys(patch)) track('UI', 'Changed', `Presentation-${field}`);
      commitRef.current(withPresentationConfig(prefsRef.current, patch));
    },
    [prefsRef, commitRef],
  );

  // Hydration guard. Seeding the deck from the server must not look like an
  // edit, or opening a document would immediately PUT the deck straight back.
  const hydratedRef = useRef(false);
  const tabsRef = useLatest(tabs);
  const saveTimer = useRef<number | null>(null);
  const saveRef = useLatest(saveDeck);

  /** Seed from the loaded document. Never counts as an edit. */
  const hydrateDeck = useCallback((serialised: string | null | undefined) => {
    hydratedRef.current = true;
    setDeck(firstDeck(parseStoredPresentation(serialised)));
  }, []);

  // Every edit goes through here so exactly one place is responsible for
  // persisting, and no verb can forget to.
  const commitDeck = useCallback(
    (next: Deck | ((prev: Deck) => Deck)) => {
      setDeck((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        // Nothing changed (a follow pass with the deck already in step): nothing to save.
        if (resolved === prev) return prev;
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          const stored = storePresentation(resolved);
          saveRef.current?.(stored ? JSON.stringify(stored) : null);
        }, DECK_SAVE_DEBOUNCE_MS);
        return resolved;
      });
    },
    [saveRef],
  );

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  // The deck follows the slide pages (docs/specs/007-editor/pages-mode.md "Slides"): each in the deck, a tab's
  // page slides in its page order. An editor saves it; a viewer only sees it, the same deck an editor would store.
  // Built on the deck as it stands when the update runs, so a stored deck hydrated in the same pass is the base.
  // A deleted page takes its slides out of the deck; the session remembers them, so an undo of the delete (or a
  // peer's) brings them back as they were.
  const [goneSlides] = useState(() => new GoneSlides());
  const followPages = useCallback(() => {
    const follow = (prev: Deck) => deckFollowingPages(prev, tabsRef.current, goneSlides);
    if (isReadOnly) setDeck(follow);
    else commitDeck(follow);
  }, [commitDeck, goneSlides, isReadOnly, tabsRef]);
  // The slides a slide page holds in the deck, which the panel offers Hide for rather than Delete.
  // One pass over the deck and the loaded Pages tabs' pages: about 0.1 ms at the 100-page cap.
  const ownPageSlideIds = useMemo(() => slidePageOwnSlideIds(deck, tabs), [deck, tabs]);

  // --- What the panel renders -----------------------------------------------

  // The current selection, as a set. A multi-selection wins; otherwise the
  // single selected element; otherwise nothing.

  // Read by verbs that need the CURRENT deck without taking it as a dep.
  const deckRef = useLatest<Deck>(deck);
  const openSlide = deck.slides.find((s) => s.id === openSlideId) ?? null;

  // Slides whose tab still exists and are not hidden, in deck order — what
  // Present will run.
  const runnable = useMemo(() => presentableSlides(deck, tabs), [deck, tabs]);
  const runnableRef = useLatest(runnable);
  // The index into the presentable list, while presenting.
  const presentingAt = presenting === null ? null : presentingIndex(presenting, runnable);
  // Stable, so a running deck's timers are not restarted by a re-render (PresentationOverlay's auto-advance).
  const setPresentingAt = useCallback(
    (next: number | null) =>
      setPresenting(next === null ? null : positionAt(next, runnableRef.current)),
    [runnableRef],
  );
  // Row previews, from the same headless renderer the Layers panel uses.
  const thumbs = useSlideThumbnails(deck, tabs);
  // Each page slide's page, named from its own tab (null once the page is gone).
  const pageLabels = useMemo(() => pageSlideLabels(deck, tabs), [deck, tabs]);
  // What each slide is about, for a row whose slide has no name: its largest text.
  const headlines = useMemo(() => slideHeadlines(deck, tabs), [deck, tabs]);

  // --- Editing verbs --------------------------------------------------------

  const newSlideFromSelection = useCallback(() => {
    const ids = idsOf(readSelection());
    if (isReadOnly || ids.size === 0) return;
    const slide: Slide = {
      id: crypto.randomUUID(),
      tabId: activeTabId,
      elementIds: [...ids],
    };
    commitDeck((prev) => ({ slides: [...prev.slides, slide] }));
    setOpenSlideId(slide.id);
    track('UI', 'Added', 'Slide');
  }, [activeTabId, commitDeck, isReadOnly, readSelection]);

  // A page as a slide (docs/specs/007-editor/pages-mode.md "Slides"): the slide
  // is the page, resolved live, so it follows the page's content wherever the page goes.
  const newPageSlide = useCallback(
    (pageId: string) => {
      if (isReadOnly) return;
      const slide: Slide = { id: crypto.randomUUID(), tabId: activeTabId, elementIds: [], pageId };
      commitDeck((prev) => ({ slides: [...prev.slides, slide] }));
      setOpenSlideId(slide.id);
      track('UI', 'Added', 'PageSlide');
    },
    [activeTabId, commitDeck, isReadOnly],
  );

  const addSelectionToSlide = useCallback(
    (slideId: string) => {
      const ids = idsOf(readSelection());
      if (isReadOnly || ids.size === 0) return;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) =>
          // Only its own tab's elements: a slide holds one tab's elements, so
          // adding from another tab is not a thing to refuse politely, it is
          // a thing that cannot be expressed.
          s.id === slideId && s.tabId === activeTabId
            ? { ...s, elementIds: [...new Set([...s.elementIds, ...ids])] }
            : s,
        ),
      }));
    },
    [activeTabId, commitDeck, isReadOnly, readSelection],
  );

  const removeFromSlide = useCallback(
    (slideId: string, elementIds: Iterable<string>) => {
      if (isReadOnly) return;
      const drop = new Set(elementIds);
      if (drop.size === 0) return;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) =>
          s.id === slideId ? { ...s, elementIds: s.elementIds.filter((id) => !drop.has(id)) } : s,
        ),
      }));
    },
    [commitDeck, isReadOnly],
  );

  const renameSlide = useCallback(
    (slideId: string, name: string) => {
      if (isReadOnly) return;
      const trimmed = name.trim();
      commitDeck((prev) => ({
        slides: prev.slides.map((s) => {
          if (s.id !== slideId) return s;
          const next = { ...s };
          // An empty name is the ABSENCE of a name, so the slide goes back to
          // its positional label rather than being called "".
          if (trimmed) next.name = trimmed;
          else delete next.name;
          return next;
        }),
      }));
    },
    [commitDeck, isReadOnly],
  );

  /**
   * The slide's time budget in minutes, or 0 / NaN to clear it.
   *
   * Stored like notes: absent rather than zero when unset, so a deck written
   * before budgets existed reads as "no targets" instead of "every slide is
   * budgeted nothing". Clamped to whole minutes and to something a talk could
   * plausibly want, because the field is a number input and a stray keypress
   * should not produce a 9,000-minute slide.
   */
  const setSlideMinutes = useCallback(
    (slideId: string, minutes: number) => {
      if (isReadOnly) return;
      const clean = Number.isFinite(minutes) ? Math.min(240, Math.max(0, Math.round(minutes))) : 0;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) => {
          if (s.id !== slideId) return s;
          const next = { ...s };
          if (clean > 0) next.minutes = clean;
          else delete next.minutes;
          return next;
        }),
      }));
    },
    [commitDeck, isReadOnly],
  );

  const setSlideNotes = useCallback(
    (slideId: string, notes: string) => {
      if (isReadOnly) return;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) => {
          if (s.id !== slideId) return s;
          const next = { ...s };
          if (notes) next.notes = notes;
          else delete next.notes;
          return next;
        }),
      }));
    },
    [commitDeck, isReadOnly],
  );

  /** Leave a slide out of the run without losing it. */
  const toggleSlideHidden = useCallback(
    (slideId: string) => {
      if (isReadOnly) return;
      // Which way it went matters: "people hide slides" and "people unhide
      // them" are different findings, and one event for both would hide that.
      const wasHidden = deckRef.current.slides.find((s) => s.id === slideId)?.hidden === true;
      track('UI', 'Toggled', wasHidden ? 'SlideShown' : 'SlideHidden');
      commitDeck((prev) => ({
        slides: prev.slides.map((s) => {
          if (s.id !== slideId) return s;
          const next = { ...s };
          // Absent rather than `false`, so a shown slide stays byte-light in
          // the stored deck the way every other optional field does.
          if (s.hidden) delete next.hidden;
          else next.hidden = true;
          return next;
        }),
      }));
    },
    [commitDeck, deckRef, isReadOnly],
  );

  const deleteSlide = useCallback(
    (slideId: string) => {
      if (isReadOnly) return;
      commitDeck((prev) => ({ slides: prev.slides.filter((s) => s.id !== slideId) }));
      setOpenSlideId((cur) => (cur === slideId ? null : cur));
      track('UI', 'Removed', 'Slide');
    },
    [commitDeck, isReadOnly],
  );

  const duplicateSlide = useCallback(
    (slideId: string) => {
      if (isReadOnly) return;
      const original = deckRef.current.slides.find((s) => s.id === slideId);
      commitDeck((prev) => {
        const at = prev.slides.findIndex((s) => s.id === slideId);
        const source = prev.slides[at];
        if (!source) return prev;
        const copy: Slide = { ...source, id: crypto.randomUUID() };
        const slides = [...prev.slides];
        slides.splice(at + 1, 0, copy);
        return { slides };
      });
      // Literal types, so the telemetry dashboard's emitter scan reads each one.
      if (original?.pageId) track('UI', 'Added', 'PageSlide');
      else if (original) track('UI', 'Added', 'Slide');
    },
    [commitDeck, deckRef, isReadOnly],
  );

  /** Move a slide to another position in the deck. Order is the deck's own. */
  const reorderSlides = useCallback(
    (fromId: string, toIndex: number) => {
      if (isReadOnly) return;
      commitDeck((prev) => {
        const from = prev.slides.findIndex((s) => s.id === fromId);
        if (from < 0 || toIndex < 0 || toIndex >= prev.slides.length || from === toIndex) {
          return prev;
        }
        const slides = [...prev.slides];
        const [moved] = slides.splice(from, 1);
        if (moved) slides.splice(toIndex, 0, moved);
        return { slides };
      });
      // A page slide dragged out of its page's order moves its page, and the deck then follows the pages: the two
      // orders are one (docs/specs/007-editor/pages-mode.md "Slides").
      const slides = [...deckRef.current.slides];
      const from = slides.findIndex((s) => s.id === fromId);
      if (from >= 0 && toIndex >= 0 && toIndex < slides.length) {
        const [moved] = slides.splice(from, 1);
        if (moved) slides.splice(toIndex, 0, moved);
        const move = pageMoveForDeckOrder({ slides }, fromId, tabsRef.current);
        if (move) movePage?.(move.tabId, move.pageId, move.unitIndex);
      }
      // One event per completed drag, not per position crossed: the reorder
      // only commits on release, so this is already once per gesture.
      track('UI', 'Moved', 'Slide');
    },
    [commitDeck, deckRef, isReadOnly, movePage, tabsRef],
  );

  /**
   * Open a slide in the panel: switch to its tab and select its members, so
   * you can see what is on it without presenting. A page slide frames its page
   * instead, as the page's own label does: the page is what is on it.
   */
  const openSlideInEditor = useCallback(
    (slideId: string) => {
      setOpenSlideId(slideId);
      const slide = deck.slides.find((s) => s.id === slideId);
      if (!slide) return;
      const tabExists = tabs.some((t) => t.id === slide.tabId);
      if (tabExists && slide.tabId !== activeTabId) {
        setActiveId(slide.tabId);
      }
      if (slide.pageId) {
        setSelectedId(null);
        setMultiSelectedIds(new Set());
        if (tabExists) framePage?.(slide.tabId, slide.pageId);
      } else if (slide.elementIds.length === 1) {
        setSelectedId(slide.elementIds[0]!);
        setMultiSelectedIds(new Set());
      } else {
        setSelectedId(null);
        setMultiSelectedIds(new Set(slide.elementIds));
      }
    },
    [activeTabId, deck.slides, framePage, setActiveId, setMultiSelectedIds, setSelectedId, tabs],
  );

  // --- Presenting -----------------------------------------------------------

  // From the first slide, or from `fromSlideId` (the row's Present from Here) when it is shown.
  const start = useCallback(
    async (fromSlideId?: string) => {
      if (runnable.length === 0) return;
      const from = fromSlideId ? runnable.findIndex((r) => r.slide.id === fromSlideId) : 0;
      // A deck reaching into a tab nobody has visited would stall mid-show, so
      // pull every unloaded tab before the first slide paints (docs/specs/006-document/per-tab-storage.md).
      // The overlay's code too (it loads on demand, lib/editor-deferred-code.ts), so its keys listen from the
      // first slide. A failed load is left to the overlay's own render, which recovers a stale build.
      setStartingDeck(true);
      try {
        await Promise.all([loadAllTabs?.(), loadPresentationOverlay().catch(() => {})]);
      } finally {
        setStartingDeck(false);
      }
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setPresentingAt(Math.max(0, from));
      track('UI', 'Started', 'Presentation');
    },
    [loadAllTabs, runnable, setMultiSelectedIds, setPresentingAt, setSelectedId],
  );

  const exitPresentation = useCallback(() => {
    setPresenting((at) => {
      if (at === null) return null;
      track('UI', 'Closed', 'Presentation');
      return null;
    });
  }, []);

  return {
    deck,
    hydrateDeck,
    openSlideId,
    openSlide,
    setOpenSlideId,
    openSlideInEditor,
    runnable,
    thumbs,
    pageLabels,
    headlines,
    newSlideFromSelection,
    newPageSlide,
    addSelectionToSlide,
    removeFromSlide,
    renameSlide,
    setSlideNotes,
    setSlideMinutes,
    deleteSlide,
    ownPageSlideIds,
    followPages,
    toggleSlideHidden,
    duplicateSlide,
    reorderSlides,
    presentingAt,
    setPresentingAt,
    config,
    updateConfig,
    startingDeck,
    start,
    exitPresentation,
  };
}
