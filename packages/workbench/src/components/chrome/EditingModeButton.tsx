'use client';

import { Glyph, HoverCard } from '@liveworkspace/ui';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { EDITING_MODES, nextEditingMode, type EditingModeRole } from '../../lib/editing-mode';

// The Editing Mode button (liveworkspace/docs/specs/004-index/footer-tools-menu.md "The Editing Mode button",
// Work Tracker 1291): between Tools and Settings in every editor's tab bar, it shows only the mode in force
// (its icon and word, in the neutral styling of its neighbours, never a role colour) and a press moves to the next mode
// the person may preview, wrapping round. With one mode there is nothing to switch, so it draws nothing.

const WORD: Record<EditingModeRole, string> = {
  edit: 'Editor',
  participate: 'Participant',
  view: 'Viewer',
};

// What the next press does, for the hover card: see the item as a narrower role, or go back to a wider one.
function nextLine(mode: EditingModeRole, next: EditingModeRole, noun: string): string {
  const back = EDITING_MODES.indexOf(next) < EDITING_MODES.indexOf(mode);
  if (back)
    return next === 'edit' ? 'Click to go back to editing.' : 'Click to go back to participating.';
  return `Click to see the ${noun} as a ${WORD[next]}.`;
}

const PRIVATE = 'Only you see the change; everyone else keeps their own role.';

// The roles' own glyphs: a pencil for Editor, a person with a plus for Participant, an eye for Viewer.
function ModeGlyph({ mode }: { mode: EditingModeRole }) {
  return (
    <Glyph size={16} units={16}>
      {mode === 'edit' ? (
        <path d="M10.5 2.5l3 3L6 13H3v-3z" />
      ) : mode === 'participate' ? (
        <>
          <circle cx="6" cy="6" r="2.2" />
          <path d="M2 13c.6-2.2 2.1-3.4 4-3.4s3.4 1.2 4 3.4M11 4.5v4M9 6.5h4" />
        </>
      ) : (
        <>
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
          <circle cx="8" cy="8" r="2" />
        </>
      )}
    </Glyph>
  );
}

/** What an app hands the button: everything but `labelled`, which the tab bar's setting decides. */
export type EditingModeWiring<R extends EditingModeRole = EditingModeRole> = {
  /** The mode in force (the session's role, narrowed by the preview). */
  mode: R;
  /** The modes this person may preview, widest first (`editingModes`). */
  modes: readonly R[];
  /** The item's noun: "canvas", "plan", "document", "design", "space". */
  noun: string;
  /** "Owned by you", "Owned by Sam" (each app's roleOwnerLabel), or empty. */
  owner: string;
  onPick: (mode: R) => void;
};

export function EditingModeButton<R extends EditingModeRole>({
  mode,
  modes,
  noun,
  owner,
  onPick,
  labelled = false,
}: EditingModeWiring<R> & { labelled?: boolean }) {
  const next = nextEditingMode(mode, modes);
  if (!next) return null;
  const word = WORD[mode];
  // What a press does, who owns the item where known, and that the preview is this person's alone.
  const description = [nextLine(mode, next, noun), owner ? `${owner}.` : '', PRIVATE]
    .filter(Boolean)
    .join(' ');
  return (
    <HoverCard title={`Editing Mode: ${word}`} description={description}>
      <button
        type="button"
        onClick={() => onPick(next)}
        aria-label={`Editing Mode: ${word}. Switch to ${WORD[next]}.`}
        data-editing-mode={mode}
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <ModeGlyph mode={mode} />
        <ChromeLabel show={labelled}>{word}</ChromeLabel>
      </button>
    </HoverCard>
  );
}
