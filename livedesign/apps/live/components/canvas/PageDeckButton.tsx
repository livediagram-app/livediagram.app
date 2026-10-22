'use client';

// A page's place in the slide deck (docs/specs/012-collaboration/presentation-mode.md "The deck follows the pages"),
// first in its title bar, left of Layout and Background: Add to Slides in the moment before the deck
// takes the page in; once it has, Hide in Slides (or Show in Slides while hidden), which hides the slide
// from the presentation or shows it again. Named beside its icon on a desktop.
import { Tooltip } from '@livedesign/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { EyeIcon, EyeOffIcon } from '@/components/panels/layers-panel-icons';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import { titleButtonClass } from './TitlePopoverButton';

const ADD_TO_SLIDES = 'Add to Slides';
const HIDE_IN_SLIDES = 'Hide in Slides';
const SHOW_IN_SLIDES = 'Show in Slides';

// The title-bar room it takes (24 px and the gap), or named beside its icon, sized for its longest
// name, so the page's label truncates first.
const DECK_ROOM = 28;
const DECK_LABELLED_ROOM = 112;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageDeckRoom(labelled: boolean): number {
  return labelled ? DECK_LABELLED_ROOM : DECK_ROOM;
}

export function PageDeckButton({
  pageId,
  deck,
  labelled = false,
}: {
  pageId: string;
  deck: PageDeckControls;
  // Named beside its icon (a desktop).
  labelled?: boolean;
}) {
  const slide = deck.slideOf(pageId);
  const label = !slide ? ADD_TO_SLIDES : slide.hidden ? SHOW_IN_SLIDES : HIDE_IN_SLIDES;
  return (
    <div
      className="pointer-events-auto flex items-center"
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={label}>
        <button
          type="button"
          // Its name says what a press does, so no aria-pressed as well.
          aria-label={label}
          data-page-deck-button={slide ? (slide.hidden ? 'hidden' : 'shown') : 'add'}
          onClick={() => (slide ? deck.toggleHidden(slide.id) : deck.add(pageId))}
          className={titleButtonClass(false, labelled)}
        >
          {!slide ? <SlideDeckIcon /> : slide.hidden ? <EyeOffIcon /> : <EyeIcon />}
          {labelled ? (
            <span aria-hidden className="whitespace-nowrap">
              {label}
            </span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}
