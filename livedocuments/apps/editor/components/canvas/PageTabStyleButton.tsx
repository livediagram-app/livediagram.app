'use client';

// Tab Style on a page's title bar (docs/specs/007-editor/pages-mode.md "Beside the cog";
// docs/specs/011-theme/canvas-and-theme-dialog.md "Opening it"): first in the bar's looks group, it opens the tab's
// Style dialog dropping from the button. An article page has no second Style: its own Style popover leads with the
// same door (PageArticleButtons' TabStyleRow).
import { lucidePalette } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedocuments/ui';
import { openTabStyleFrom } from '@/lib/tab-style-opener';
import { track } from '@/lib/telemetry';
import { titleButtonClass } from './TitlePopoverButton';

const StyleIcon = lucideGlyph(lucidePalette, 14);

// The title-bar room it takes (its icon alone, or named beside it), so the page's label truncates first.
const STYLE_ROOM = 28;
const STYLE_LABELLED_ROOM = 67;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageTabStyleRoom(labelled: boolean): number {
  return labelled ? STYLE_LABELLED_ROOM : STYLE_ROOM;
}

export function PageTabStyleButton({ labelled }: { labelled: boolean }) {
  return (
    <Tooltip label="Style">
      <button
        type="button"
        aria-label="Style"
        aria-haspopup="dialog"
        data-tab-style-button=""
        onClick={(e) => {
          track('UI', 'Opened', 'ThemePicker');
          openTabStyleFrom(e.currentTarget);
        }}
        className={titleButtonClass(false, labelled)}
      >
        <StyleIcon />
        {labelled ? <span aria-hidden>Style</span> : null}
      </button>
    </Tooltip>
  );
}
