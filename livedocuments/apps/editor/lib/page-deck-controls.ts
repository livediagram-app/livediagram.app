// A page's controls over the slide deck (docs/specs/007-editor/pages-mode.md "Slides"): find the deck's slide of a
// page on the tab, add one, hide or show it, write its note cards, present from it. Absent for a person who cannot
// change the deck: the Contents menu that offers them is an Editor's.
import { slideNoteCards, type Deck, type NoteCard } from '@livedocuments/document';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';

export function pageDeckControls(
  deck: Deck,
  tabId: string,
  canEdit: boolean,
  verbs: {
    newPageSlide: (pageId: string) => void;
    toggleSlideHidden: (slideId: string) => void;
    setSlideNoteCards: (slideId: string, cards: readonly NoteCard[]) => void;
    start: (fromSlideId?: string) => Promise<void>;
  },
): PageDeckControls | undefined {
  if (!canEdit) return undefined;
  return {
    // A page's first slide: a stored deck may hold a copy too (pages-mode.md "Stored slides the panel made").
    slideOf: (pageId) => {
      const slide = deck.slides.find((s) => s.tabId === tabId && s.pageId === pageId);
      return slide
        ? { id: slide.id, hidden: slide.hidden === true, noteCards: slideNoteCards(slide) }
        : undefined;
    },
    add: verbs.newPageSlide,
    toggleHidden: verbs.toggleSlideHidden,
    setNoteCards: verbs.setSlideNoteCards,
    present: (slideId) => {
      track('UI', 'Used', 'PresentFromHere');
      void verbs.start(slideId);
    },
  };
}
