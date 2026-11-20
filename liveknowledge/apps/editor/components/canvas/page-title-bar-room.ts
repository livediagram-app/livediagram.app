// The room a page's title bar takes on screen (docs/specs/007-editor/pages-mode.md "Beside the
// cog", "The label fits its page"): its fixed buttons, named or as icons, and whether they can be
// named at all, so the page's label has what is left.
import { appearanceRows, pageAppearanceRoom } from './PageAppearanceButton';
import { pageArticleRoom } from './PageArticleButtons';
import { pageBackgroundRoom } from './PageBackgroundButton';
import { pageLayoutsRoom } from './PageLayoutsButton';
import { pageLockRoom } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import { pageNotesRoom } from './PageNotesButton';
import { pageTabStyleRoom } from './PageTabStyleButton';
import { pageTidyUpRoom } from './PageTidyUpButton';
import {
  TITLE_BAR_BUTTON,
  titleBarChromeRoom,
} from '@liveworkspace/workbench/components/canvas/PageTitleBar';

// Screen px: the cog's width, a gap between the bar and the label, and the narrowest a label is
// still worth showing.
const COG_ROOM = TITLE_BAR_BUTTON;
const LABEL_GAP = 8;
export const LABEL_MIN = 40;

type TitleBarButtons = {
  // Someone may edit: the cog and the lock show.
  edit: boolean;
  locked: boolean;
  // A slide in the deck: its Notes.
  notes: boolean;
  // An infographic or slide page's Layout and Background.
  page: boolean;
  // An article page's Style, Text and Background.
  article?: boolean;
  // Tab Style (not on an article page, whose own Style leads with it).
  style?: boolean;
  tidy: boolean;
};

/** The fixed buttons' room, each named beside its icon or not, with the bar's card round them
 *  (PageTitleBar: its edges, gaps and the dividers between its groups). */
export function titleBarFixedRoom(b: TitleBarButtons, named: boolean, phone = false): number {
  if (!b.edit) return 0;
  // A phone's bar ("On a phone, three buttons at most"): Appearance for the looks (named when `named`), Notes, the
  // cog; no Tidy, no lock, Notes and the cog their icons alone.
  if (phone) {
    const appearance = appearanceRows(b).length > 0 ? 1 : 0;
    const notes = b.notes ? 1 : 0;
    return (
      COG_ROOM +
      appearance * pageAppearanceRoom(named) +
      (notes ? pageNotesRoom(false) : 0) +
      titleBarChromeRoom(appearance + notes + 1, appearance + notes + 1) +
      LABEL_GAP
    );
  }
  const look = (b.style ? 1 : 0) + (b.page ? 2 : 0) + (b.article ? 3 : 0);
  const tools = (b.notes ? 1 : 0) + (b.tidy ? 1 : 0);
  const buttons =
    COG_ROOM +
    pageLockRoom(b.locked, named) +
    (b.notes ? pageNotesRoom(named) : 0) +
    (b.page ? pageLayoutsRoom(named) + pageBackgroundRoom(named) : 0) +
    (b.article ? pageArticleRoom(named) + pageBackgroundRoom(named) : 0) +
    (b.style ? pageTabStyleRoom(named) : 0) +
    (b.tidy ? pageTidyUpRoom(named) : 0);
  const groups = (look ? 1 : 0) + (tools ? 1 : 0) + 1;
  return buttons + titleBarChromeRoom(look + tools + 2, groups) + LABEL_GAP;
}

/** Whether the buttons name themselves: on a desktop, while the page on screen (`room`, its width at
 *  this zoom) holds them named and still leaves the label its least room. Zoomed out further, or on
 *  a phone, they are icons. */
export function titleBarNamed(room: number, b: TitleBarButtons, mobile: boolean): boolean {
  // A phone's buttons are always icons.
  return !mobile && room - titleBarFixedRoom(b, true) >= LABEL_MIN;
}

/** Whether a phone's Appearance names itself: while the page on screen (`room`) holds the bar with it named. A phone
 *  shows no page label, so the bar may take the page's whole width. */
export function appearanceNamed(room: number, b: TitleBarButtons): boolean {
  return room >= titleBarFixedRoom(b, true, true) - LABEL_GAP;
}
