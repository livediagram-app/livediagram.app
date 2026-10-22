'use client';

// A slide page's speaker notes, in its title bar once the page is in the slide deck
// (docs/specs/007-editor/pages-mode.md "Slides"): Add Notes while the slide has none, Notes
// (pressed) once it has. A popover holds the slide's notes, the same notes the Slide Deck panel
// writes and the presenter view shows: they belong to the deck's slide, not to the page.
import { useRef } from 'react';
import { lucideFileText } from '@livepages/icons/lucide';
import { lucideGlyph } from '@livepages/ui';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const NotesIcon = lucideGlyph(lucideFileText, 14);

const ADD_NOTES = 'Add Notes';
export const NOTES = 'Notes';

// The title-bar room it takes (24 px and the gap, or named beside its icon), so the page's label
// truncates first.
const NOTES_ROOM = 28;
const NOTES_LABELLED_ROOM = 88;
const POPOVER_WIDTH = 320;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageNotesRoom(labelled: boolean): number {
  return labelled ? NOTES_LABELLED_ROOM : NOTES_ROOM;
}

function NotesBody({
  slideId,
  notes,
  deck,
}: {
  slideId: string;
  notes: string;
  deck: PageDeckControls;
}) {
  // One 'notes were written' event per opening, on the first keystroke, as the panel counts them.
  const tracked = useRef(false);
  return (
    <label className="flex flex-col gap-1.5" data-page-notes-popover="">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Speaker Notes
      </span>
      <textarea
        value={notes}
        autoFocus
        rows={6}
        onChange={(e) => {
          if (!tracked.current) {
            tracked.current = true;
            track('UI', 'Changed', 'SlideNotes');
          }
          deck.setNotes(slideId, e.target.value);
        }}
        // Typing is the notes', never the editor's shortcuts.
        onKeyDown={(e) => {
          if (e.key !== 'Escape') e.stopPropagation();
        }}
        placeholder="What you'll say over this slide…"
        className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-snug text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      />
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        Shown to you in the presenter view; never on the slide.
      </span>
    </label>
  );
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
  const slide = deck.slideOf(pageId);
  if (!slide) return null;
  const has = slide.notes.trim().length > 0;
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
        icon={<NotesIcon />}
        width={POPOVER_WIDTH}
        onOpen={() => track('UI', 'Opened', 'PageNotesButton')}
      >
        <NotesBody slideId={slide.id} notes={slide.notes} deck={deck} />
      </TitlePopoverButton>
    </div>
  );
}
