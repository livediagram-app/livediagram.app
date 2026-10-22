// A page's controls over the slide deck (docs/specs/012-collaboration/presentation-mode.md
// "The deck follows the pages"): find the deck's slide of a page on the tab, add one, hide or show it, write its notes.
// Absent for a person who cannot change the deck.
import type { Deck } from '@livedesign/document';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';

export function pageDeckControls(
  deck: Deck,
  tabId: string,
  canEdit: boolean,
  verbs: {
    newPageSlide: (pageId: string) => void;
    toggleSlideHidden: (slideId: string) => void;
    setSlideNotes: (slideId: string, notes: string) => void;
  },
): PageDeckControls | undefined {
  if (!canEdit) return undefined;
  return {
    slideOf: (pageId) => {
      const slide = deck.slides.find((s) => s.tabId === tabId && s.pageId === pageId);
      return slide
        ? { id: slide.id, hidden: slide.hidden === true, notes: slide.notes ?? '' }
        : undefined;
    },
    add: verbs.newPageSlide,
    toggleHidden: verbs.toggleSlideHidden,
    setNotes: verbs.setSlideNotes,
  };
}
