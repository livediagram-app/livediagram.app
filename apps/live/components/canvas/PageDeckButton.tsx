'use client';

// A slide page's place in the slide deck (docs/specs/007-editor/illustrate-pages.md "Slides"),
// beside its cog: Add to slide deck while the deck has no slide of the page; once it has, an eye
// that hides the slide from the presentation or shows it again.
import { Tooltip } from '@livediagram/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { EyeIcon, EyeOffIcon } from '@/components/panels/layers-panel-icons';
import type { PageDeckControls } from '@/hooks/editor/useIllustratePages';

export function PageDeckButton({ pageId, deck }: { pageId: string; deck: PageDeckControls }) {
  const slide = deck.slideOf(pageId);
  const label = !slide
    ? 'Add to slide deck'
    : slide.hidden
      ? 'Show in the presentation'
      : 'Hide from the presentation';
  return (
    <div
      className="pointer-events-auto"
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          {...(slide ? { 'aria-pressed': !slide.hidden } : {})}
          data-page-deck-button={slide ? (slide.hidden ? 'hidden' : 'shown') : 'add'}
          onClick={() => (slide ? deck.toggleHidden(slide.id) : deck.add(pageId))}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            slide?.hidden
              ? 'text-slate-400 dark:text-slate-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {!slide ? <SlideDeckIcon /> : slide.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </Tooltip>
    </div>
  );
}
