'use client';

// A slide page's speaker notes, in its title bar once the page is in the slide deck
// (docs/specs/007-editor/pages-mode.md "Slides"): Add Notes while the slide has none, Notes
// (pressed) once it has. A popover (a bottom sheet on a phone) holds the slide's note cards
// (docs/specs/012-collaboration/speaker-note-cards.md), the same cards the Slide Deck panel writes
// and the presenter view flips through: they belong to the deck's slide, not to the page.
import { useCallback, useRef } from 'react';
import { slideHasNotes } from '@livedocuments/document';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';
import { NoteCardList } from '@/components/slide-notes/NoteCardList';
import { NoteCardsIcon } from '@/components/slide-notes/NoteCardsIcon';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const ADD_NOTES = 'Add Notes';
export const NOTES = 'Notes';

// The title-bar room it takes (24 px and the gap, or named beside its icon), so the page's label
// truncates first.
const NOTES_ROOM = 28;
const NOTES_LABELLED_ROOM = 88;
// Room for a card's line at 13 px (blueprint NOTES_POPOVER_WIDTH).
const POPOVER_WIDTH = 360;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageNotesRoom(labelled: boolean): number {
  return labelled ? NOTES_LABELLED_ROOM : NOTES_ROOM;
}

export function PageNotesButton({
  pageId,
  deck,
  labelled,
}: {
  pageId: string;
  deck: PageDeckControls;
  // Named beside its icon (a desktop).
  labelled: boolean;
}) {
  // An open card takes Escape before the popover does (NoteCardList's takeEscape).
  const escapeCard = useRef<(() => boolean) | null>(null);
  const takeEscape = useCallback((escape: (() => boolean) | null) => {
    escapeCard.current = escape;
  }, []);
  const slide = deck.slideOf(pageId);
  if (!slide) return null;
  const has = slideHasNotes(slide);
  return (
    <div
      className="pointer-events-auto flex items-center"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TitlePopoverButton
        name={has ? NOTES : ADD_NOTES}
        on={has}
        labelled={labelled}
        className={titleButtonClass}
        icon={<NoteCardsIcon />}
        width={POPOVER_WIDTH}
        onOpen={() => track('UI', 'Opened', 'PageNotesButton')}
        onEscape={() => escapeCard.current?.() ?? false}
      >
        <div className="flex flex-col gap-2 px-4 sm:px-0" data-page-notes-popover="">
          {/* Keyed by the slide, so another slide's list never inherits this one's open card. */}
          <NoteCardList
            key={slide.id}
            cards={slide.noteCards}
            onChange={(cards) => deck.setNoteCards(slide.id, cards)}
            takeEscape={takeEscape}
          />
          <span className="px-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Shown to you in the presenter view; never on the slide.
          </span>
        </div>
      </TitlePopoverButton>
    </div>
  );
}
