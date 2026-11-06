'use client';

// The slide deck's state (docs/specs/012-collaboration/presentation-mode.md): the deck itself, the verbs a page's
// Contents menu and title bar drive (Add to Slides, Hide / Show in Slides, Notes), and the presentation Present runs.
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deckFollowingPages,
  deckWithPageSlideDetails,
  GoneSlides,
  EMPTY_DECK,
  firstDeck,
  parseStoredPresentation,
  presentableSlides,
  storePresentation,
  withNoteCards,
  type Deck,
  type NoteCard,
  type PageSlideDetail,
  type Slide,
  type Tab,
} from '@livedocuments/document';

import { track } from '@/lib/telemetry';
import {
  readPresentationConfig,
  withPresentationConfig,
  type PresentationConfig,
} from '@/lib/presentation-config';
import type { UserPreferences } from '@/lib/user-preferences';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import {
  positionAt,
  presentingIndex,
  type PresentingPosition,
} from '@liveworkspace/workbench/lib/presenting-position';
import { loadPresentationOverlay } from '@/lib/editor-deferred-code';

// How long after the last deck edit the save fires. Deck edits arrive in
// bursts (drag a row through four positions, type a sentence of notes), and
// each one is a whole-document metadata PUT. What is still waiting goes at once when the writing leaves the screen
// (docs/specs/012-collaboration/speaker-note-cards.md "Saving").
export const DECK_SAVE_DEBOUNCE_MS = 900;

export type SlideDeckState = ReturnType<typeof useSlideDeck>;

export function useSlideDeck({
  tabs,
  activeTabId,
  setSelectedId,
  setMultiSelectedIds,
  isReadOnly,
  saveDeck,
  prefs,
  commitPrefs,
}: {
  // The person's preferences, where the presenter settings live, and how a change to them is written.
  prefs: UserPreferences;
  commitPrefs: (next: UserPreferences) => void;
  tabs: Tab[];
  activeTabId: string;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  isReadOnly: boolean;
  /** Persists the serialised deck (null clears it); `unload` when the page is going. Absent before hydration. */
  saveDeck?: (serialised: string | null, opts?: { unload: true }) => void;
}) {
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  // Non-null only while presenting: the slide on screen, by id (@liveworkspace/workbench/lib/presenting-position.ts), so a peer's edit to the
  // deck or its tabs never moves the presenter to another slide.
  const [presenting, setPresenting] = useState<PresentingPosition | null>(null);
  // The tab a show runs (presentation-mode.md "One tab, one show"): the open tab, held from Present until the show
  // ends, so a show never changes under the presenter when the open tab does.
  const [showTabId, setShowTabId] = useState<string | null>(null);
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
  // The deck the timer will save, until it does (or a flush takes it first).
  const pendingRef = useRef<Deck | null>(null);
  const saveRef = useLatest(saveDeck);

  // Saves the waiting deck now, if there is one. Serialised here, never per keystroke.
  const sendPending = useCallback(
    (unload: boolean) => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      const stored = storePresentation(pending);
      const serialised = stored ? JSON.stringify(stored) : null;
      if (unload) saveRef.current?.(serialised, { unload: true });
      else saveRef.current?.(serialised);
    },
    [saveRef],
  );

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
        pendingRef.current = resolved;
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => sendPending(false), DECK_SAVE_DEBOUNCE_MS);
        return resolved;
      });
    },
    [sendPending],
  );

  // The writing left the screen (a card closed, the Notes popover closed or moved to another slide): what the
  // debounce holds goes now. Asked for as a render, so the save runs after the commit of every deck update queued
  // before it (the blank card a close removes rides the same save), from an effect rather than inside an updater.
  const [flushAsked, setFlushAsked] = useState(0);
  const flushDeckSave = useCallback(() => setFlushAsked((n) => n + 1), []);
  useEffect(() => {
    if (flushAsked > 0) sendPending(false);
  }, [flushAsked, sendPending]);

  // The page going, or the editor left for another page of the app: the waiting deck goes at once, kept alive past
  // the page (apiSaveDocumentMeta's `unload`). A page the back-forward cache keeps has nothing left to send twice.
  useEffect(() => {
    const leave = () => sendPending(true);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [sendPending]);

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
  // Read by verbs that need the CURRENT deck without taking it as a dep.
  const deckRef = useLatest<Deck>(deck);

  // The tab's own slides that are not hidden, in page order: what Present will run, or is running. The open tab's,
  // until a show starts; then the tab it started on, until it ends.
  const runTabId = presenting !== null && showTabId ? showTabId : activeTabId;
  const runTab = useMemo(() => tabs.find((t) => t.id === runTabId), [tabs, runTabId]);
  const runnable = useMemo(() => presentableSlides(deck, runTab), [deck, runTab]);
  const runnableRef = useLatest(runnable);
  // The index into the presentable list, while presenting.
  const presentingAt = presenting === null ? null : presentingIndex(presenting, runnable);
  // Stable, so a running deck's timers are not restarted by a re-render (PresentationOverlay's auto-advance).
  const setPresentingAt = useCallback(
    (next: number | null) =>
      setPresenting(next === null ? null : positionAt(next, runnableRef.current)),
    [runnableRef],
  );
  // --- Editing verbs --------------------------------------------------------

  // A page as a slide (docs/specs/007-editor/pages-mode.md "Slides"): the slide
  // is the page, resolved live, so it follows the page's content wherever the page goes.
  const newPageSlide = useCallback(
    (pageId: string) => {
      if (isReadOnly) return;
      const slide: Slide = { id: crypto.randomUUID(), tabId: activeTabId, elementIds: [], pageId };
      commitDeck((prev) => ({ slides: [...prev.slides, slide] }));
      track('UI', 'Added', 'PageSlide');
    },
    [activeTabId, commitDeck, isReadOnly],
  );

  // A slide's speaker notes as note cards (docs/specs/012-collaboration/speaker-note-cards.md): the cards and the
  // `notes` mirror older readers keep reading, both gone with the last card.
  const setSlideNoteCards = useCallback(
    (slideId: string, cards: readonly NoteCard[]) => {
      if (isReadOnly) return;
      commitDeck((prev) => ({
        slides: prev.slides.map((s) => (s.id === slideId ? withNoteCards(s, cards) : s)),
      }));
    },
    [commitDeck, isReadOnly],
  );

  // An imported deck's notes and hidden slides onto its pages' own slides (docs/specs/020-import-export/
  // office-import.md "One undo step"); the follow pass then runs them into page order.
  const adoptImportedSlides = useCallback(
    (tabId: string, details: readonly PageSlideDetail[]) => {
      if (isReadOnly) return;
      commitDeck((prev) => deckWithPageSlideDetails(prev, tabId, details));
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

  // --- Presenting -----------------------------------------------------------

  // From the first slide, or from `fromSlideId` (a page's Present From Here in Contents) when it is shown.
  const start = useCallback(
    async (fromSlideId?: string) => {
      if (runnable.length === 0) return;
      const from = fromSlideId ? runnable.findIndex((r) => r.slide.id === fromSlideId) : 0;
      // The show is the open tab's, which is loaded: only the overlay's code waits (it loads on demand,
      // lib/editor-deferred-code.ts), so its keys listen from the first slide. A failed load is left to the
      // overlay's own render, which recovers a stale build.
      const tabId = activeTabId;
      setStartingDeck(true);
      try {
        await loadPresentationOverlay().catch(() => {});
      } finally {
        setStartingDeck(false);
      }
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setShowTabId(tabId);
      setPresenting(positionAt(Math.max(0, from), runnable));
      track('UI', 'Started', 'Presentation');
    },
    [activeTabId, runnable, setMultiSelectedIds, setSelectedId],
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
    runnable,
    newPageSlide,
    setSlideNoteCards,
    flushDeckSave,
    adoptImportedSlides,
    followPages,
    toggleSlideHidden,
    presentingAt,
    setPresentingAt,
    config,
    updateConfig,
    startingDeck,
    start,
    exitPresentation,
  };
}
