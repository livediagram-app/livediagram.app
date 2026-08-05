'use client';

// The slide deck's state (spec/31): the deck itself, the editing verbs the
// Slide Deck panel drives, and the presentation the Start button runs.
//
// The deck is diagram-level, not per-tab, because a slide belongs to one tab
// but the DECK does not: its order interleaves tabs freely (A, C, A), so no
// single tab can own the list. It rides the diagram-metadata save, not the
// per-tab element save.
//
// Slides hold element REFERENCES. Nothing here copies an element, which is
// what keeps a deck in step with the diagram it presents: edit a shape and
// every slide it is on shows the new version, because no slide ever held the
// old one. Deleting an element is handled the same way — by NOT handling it,
// so the slide simply resolves past the missing id and undo puts it back.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  EMPTY_DECK,
  firstDeck,
  parseStoredPresentation,
  presentableSlides,
  storePresentation,
  type Deck,
  type Slide,
  type Tab,
} from '@livediagram/diagram';

import { track } from '@/lib/telemetry';
import { useSlideThumbnails } from '@/hooks/ui/useSlideThumbnails';
import {
  DEFAULT_PRESENTATION_CONFIG,
  loadPresentationConfig,
  savePresentationConfig,
  type PresentationConfig,
} from '@/lib/presentation-config';

// How long after the last deck edit the save fires. Deck edits arrive in
// bursts (drag a row through four positions, type a sentence of notes), and
// each one is a whole-diagram metadata PUT.
const DECK_SAVE_DEBOUNCE_MS = 900;

export type SlideDeckState = ReturnType<typeof useSlideDeck>;

export function useSlideDeck({
  tabs,
  activeTabId,
  setActiveId,
  selectedId,
  multiSelectedIds,
  setSelectedId,
  setMultiSelectedIds,
  isReadOnly,
  saveDeck,
  loadAllTabs,
}: {
  tabs: Tab[];
  activeTabId: string;
  setActiveId: (id: string) => void;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  isReadOnly: boolean;
  /** Persists the serialised deck (null clears it). Absent before hydration. */
  saveDeck?: (serialised: string | null) => void;
  /** Pulls every not-yet-loaded tab, so a deck can reach a tab nobody visited. */
  loadAllTabs?: () => Promise<void>;
}) {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  // Which slide the PANEL has open. Separate from the presentation's own
  // index: checking slide 4 in the panel should not mean starting there.
  const [openSlideId, setOpenSlideId] = useState<string | null>(null);
  // Read by verbs that need the CURRENT deck without taking it as a dep.
  const deckRef = useRef<Deck>(EMPTY_DECK);
  // Non-null only while presenting: the index into the presentable list.
  const [presentingAt, setPresentingAt] = useState<number | null>(null);
  const [startingDeck, setStartingDeck] = useState(false);
  // Device-local presenter settings (spec/31). Owned here rather than in the
  // overlay because the FIT reads them too — "Actual size" is a setting about
  // the camera, and the camera lives outside the overlay.
  const [config, setConfig] = useState<PresentationConfig>(DEFAULT_PRESENTATION_CONFIG);
  useEffect(() => setConfig(loadPresentationConfig()), []);
  const updateConfig = useCallback((patch: Partial<PresentationConfig>) => {
    // The FIELD, not the value: what we want to learn is which settings people
    // reach for at all. Values would multiply the vocabulary for no extra
    // signal, and the enum is deliberately closed.
    for (const field of Object.keys(patch)) track('UI', 'Changed', `Presentation-${field}`);
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      savePresentationConfig(next);
      return next;
    });
  }, []);

  // Hydration guard. Seeding the deck from the server must not look like an
  // edit, or opening a diagram would immediately PUT the deck straight back.
  const hydratedRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const saveRef = useRef(saveDeck);
  saveRef.current = saveDeck;

  /** Seed from the loaded diagram. Never counts as an edit. */
  const hydrateDeck = useCallback((serialised: string | null | undefined) => {
    hydratedRef.current = true;
    setDeck(firstDeck(parseStoredPresentation(serialised)));
  }, []);

  // Every edit goes through here so exactly one place is responsible for
  // persisting, and no verb can forget to.
  const commitDeck = useCallback((next: Deck | ((prev: Deck) => Deck)) => {
    setDeck((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const stored = storePresentation(resolved);
        saveRef.current?.(stored ? JSON.stringify(stored) : null);
      }, DECK_SAVE_DEBOUNCE_MS);
      return resolved;
    });
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  // --- What the panel renders -----------------------------------------------

  // The current selection, as a set. A multi-selection wins; otherwise the
  // single selected element; otherwise nothing.
  const selectionIds = useMemo(() => {
    if (multiSelectedIds.size > 0) return new Set(multiSelectedIds);
    return selectedId ? new Set([selectedId]) : new Set<string>();
  }, [multiSelectedIds, selectedId]);

  deckRef.current = deck;
  const openSlide = deck.slides.find((s) => s.id === openSlideId) ?? null;

  // Slides whose tab still exists and are not hidden, in deck order — what
  // Present will run.
  const runnable = useMemo(() => presentableSlides(deck, tabs), [deck, tabs]);
  // Row previews, from the same headless renderer the Layers panel uses.
  const thumbs = useSlideThumbnails(deck, tabs);

  // --- Editing verbs --------------------------------------------------------

  const newSlideFromSelection = useCallback(() => {
    if (isReadOnly || selectionIds.size === 0) return;
    const slide: Slide = {
      id: crypto.randomUUID(),
      tabId: activeTabId,
      elementIds: [...selectionIds],
    };
    commitDeck((prev) => ({ slides: [...prev.slides, slide] }));
    setOpenSlideId(slide.id);
    track('UI', 'Added', 'Slide');
  }, [activeTabId, commitDeck, isReadOnly, selectionIds]);

  const addSelectionToSlide = useCallback(
    (slideId: string) => {
      if (isReadOnly || selectionIds.size === 0) return;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) =>
          // Only its own tab's elements: a slide holds one tab's elements, so
          // adding from another tab is not a thing to refuse politely, it is
          // a thing that cannot be expressed.
          s.id === slideId && s.tabId === activeTabId
            ? { ...s, elementIds: [...new Set([...s.elementIds, ...selectionIds])] }
            : s,
        ),
      }));
    },
    [activeTabId, commitDeck, isReadOnly, selectionIds],
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
    [commitDeck, isReadOnly],
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
      commitDeck((prev) => {
        const at = prev.slides.findIndex((s) => s.id === slideId);
        const source = prev.slides[at];
        if (!source) return prev;
        const copy: Slide = { ...source, id: crypto.randomUUID() };
        const slides = [...prev.slides];
        slides.splice(at + 1, 0, copy);
        return { slides };
      });
      track('UI', 'Added', 'Slide');
    },
    [commitDeck, isReadOnly],
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
      // One event per completed drag, not per position crossed: the reorder
      // only commits on release, so this is already once per gesture.
      track('UI', 'Moved', 'Slide');
    },
    [commitDeck, isReadOnly],
  );

  /**
   * Open a slide in the panel: switch to its tab and select its members, so
   * you can see what is on it without presenting.
   */
  const openSlideInEditor = useCallback(
    (slideId: string) => {
      setOpenSlideId(slideId);
      const slide = deck.slides.find((s) => s.id === slideId);
      if (!slide) return;
      if (tabs.some((t) => t.id === slide.tabId) && slide.tabId !== activeTabId) {
        setActiveId(slide.tabId);
      }
      if (slide.elementIds.length === 1) {
        setSelectedId(slide.elementIds[0]!);
        setMultiSelectedIds(new Set());
      } else {
        setSelectedId(null);
        setMultiSelectedIds(new Set(slide.elementIds));
      }
    },
    [activeTabId, deck.slides, setActiveId, setMultiSelectedIds, setSelectedId, tabs],
  );

  // --- Presenting -----------------------------------------------------------

  const start = useCallback(async () => {
    if (runnable.length === 0) return;
    // A deck reaching into a tab nobody has visited would stall mid-show, so
    // pull every unloaded tab before the first slide paints (spec/13).
    setStartingDeck(true);
    try {
      await loadAllTabs?.();
    } finally {
      setStartingDeck(false);
    }
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setPresentingAt(0);
    track('UI', 'Started', 'Presentation');
  }, [loadAllTabs, runnable.length, setMultiSelectedIds, setSelectedId]);

  const exitPresentation = useCallback(() => {
    setPresentingAt((at) => {
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
    selectionCount: selectionIds.size,
    // The ids themselves, for "Remove selection": the panel should not have
    // to be handed the selection a second time when the hook already has it.
    currentSelectionIds: useMemo(() => [...selectionIds], [selectionIds]),
    runnable,
    thumbs,
    newSlideFromSelection,
    addSelectionToSlide,
    removeFromSlide,
    renameSlide,
    setSlideNotes,
    setSlideMinutes,
    deleteSlide,
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
