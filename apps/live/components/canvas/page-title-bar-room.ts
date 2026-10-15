// The room a page's title bar takes on screen (docs/specs/007-editor/illustrate-pages.md "Beside the
// cog", "The label fits its page"): its fixed buttons, named or as icons, and whether they can be
// named at all, so the page's label and an empty logo page's invite share what is left.
import { logoTitleBarRoom } from './LogoTitleBar';
import { pageArticleRoom } from './PageArticleButtons';
import { pageBackgroundRoom } from './PageBackgroundButton';
import { pageLayoutsRoom } from './PageLayoutsButton';
import { pageDeckRoom } from './PageDeckButton';
import { pageLockRoom } from './PageLockButton';
import { pageNotesRoom } from './PageNotesButton';
import { pageTidyUpRoom } from './PageTidyUpButton';

// Screen px: the cog's width plus a gap, and the narrowest a label is still worth showing.
export const COG_ROOM = 32;
export const LABEL_MIN = 40;

export type TitleBarButtons = {
  // Someone may edit: the cog and the lock show.
  edit: boolean;
  locked: boolean;
  deck: boolean;
  // A slide in the deck: its Add Notes.
  notes: boolean;
  logo: boolean;
  // An infographic or slide page's Layout and Background.
  page: boolean;
  // An article page's Style, Text and Background.
  article?: boolean;
  tidy: boolean;
};

/** The fixed buttons' room, each named beside its icon or not. */
export function titleBarFixedRoom(b: TitleBarButtons, named: boolean): number {
  return (
    (b.edit ? COG_ROOM + pageLockRoom(b.locked, named) : 0) +
    (b.deck ? pageDeckRoom(named) : 0) +
    (b.notes ? pageNotesRoom(named) : 0) +
    (b.logo ? logoTitleBarRoom(true, named) : 0) +
    (b.page ? pageLayoutsRoom(named) + pageBackgroundRoom(named) : 0) +
    (b.article ? pageArticleRoom(named) + pageBackgroundRoom(named) : 0) +
    (b.tidy ? pageTidyUpRoom() : 0)
  );
}

/** Whether the buttons name themselves: on a desktop, while the page on screen (`room`, its width at
 *  this zoom) holds them named and still leaves the label its least room. Zoomed out further, or on
 *  a phone, they are icons. */
export function titleBarNamed(room: number, b: TitleBarButtons, mobile: boolean): boolean {
  return !mobile && room - titleBarFixedRoom(b, true) >= LABEL_MIN;
}
