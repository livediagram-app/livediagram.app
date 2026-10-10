// A slide page's controls over the slide deck (docs/specs/007-editor/illustrate-pages.md
// "Slides"): find the deck's slide of a page on the tab, add one, hide or show it. Absent for a
// person who cannot change the deck.
import type { Deck } from '@livediagram/document';
import type { PageDeckControls } from '@/hooks/editor/useIllustratePages';

export function pageDeckControls(
  deck: Deck,
  tabId: string,
  canEdit: boolean,
  verbs: { newPageSlide: (pageId: string) => void; toggleSlideHidden: (slideId: string) => void },
): PageDeckControls | undefined {
  if (!canEdit) return undefined;
  return {
    slideOf: (pageId) => {
      const slide = deck.slides.find((s) => s.tabId === tabId && s.pageId === pageId);
      return slide ? { id: slide.id, hidden: slide.hidden === true } : undefined;
    },
    add: verbs.newPageSlide,
    toggleHidden: verbs.toggleSlideHidden,
  };
}
