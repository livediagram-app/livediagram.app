// The room a page's title bar takes on screen (docs/specs/007-editor/pages-mode.md "Beside the
// cog", "The label fits its page"): its fixed buttons, named or as icons, and whether they can be
// named at all, so the page's label and an empty logo page's invite share what is left.
import { photoTitleBarRoom } from '@/components/photo/photo-title-bar-room';
import { logoTitleBarRoom } from './LogoTitleBar';
import { pageBackgroundRoom } from './PageBackgroundButton';
import { pageLayoutsRoom } from './PageLayoutsButton';
import { pageLockRoom } from '@liveworkspace/workbench/components/canvas/PageLockButton';
import { pageDeviceRoom } from './wireframe/PageDeviceButton';
import { appearanceRows, pageAppearanceRoom } from './PageAppearanceButton';
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
  logo: boolean;
  // A photo page's Image, Select and Filter menus.
  photo?: boolean;
  // A wireframe page's Layout and Background.
  page: boolean;
  // A wireframe page's Device.
  device?: boolean;
};

/** The fixed buttons' room, each named beside its icon or not, with the bar's card round them
 *  (PageTitleBar: its edges, gaps and the divider between its two groups). */
export function titleBarFixedRoom(b: TitleBarButtons, named: boolean, phone = false): number {
  if (!b.edit) return 0;
  // A phone's bar ("Beside the cog", "On a phone"): a wireframe page's looks under Appearance (named when `named`), a
  // logo page's Mirror and Guides with no Tidy, a photo page's menus, the cog; no lock, the rest their icons alone.
  if (phone) {
    const appearance = appearanceRows(b).length > 0 ? 1 : 0;
    const tools = appearance + (b.logo ? 2 : 0) + (b.photo ? 3 : 0);
    const buttons =
      COG_ROOM +
      appearance * pageAppearanceRoom(named) +
      (b.logo ? logoTitleBarRoom(false, false) : 0) +
      (b.photo ? photoTitleBarRoom(false) : 0);
    return buttons + titleBarChromeRoom(tools + 1, tools ? 2 : 1) + LABEL_GAP;
  }
  const tools = (b.logo ? 3 : 0) + (b.photo ? 3 : 0) + (b.page ? 2 : 0) + (b.device ? 1 : 0);
  const buttons =
    COG_ROOM +
    pageLockRoom(b.locked, named) +
    (b.logo ? logoTitleBarRoom(true, named) : 0) +
    (b.photo ? photoTitleBarRoom(named) : 0) +
    (b.page ? pageLayoutsRoom(named) + pageBackgroundRoom(named) : 0) +
    (b.device ? pageDeviceRoom(named) : 0);
  return buttons + titleBarChromeRoom(tools + 2, tools ? 2 : 1) + LABEL_GAP;
}

/** Whether the buttons name themselves: on a desktop, while the page on screen (`room`, its width at
 *  this zoom) holds them named and still leaves the label its least room. Zoomed out further, or on
 *  a phone, they are icons. */
export function titleBarNamed(room: number, b: TitleBarButtons, mobile: boolean): boolean {
  return !mobile && room - titleBarFixedRoom(b, true) >= LABEL_MIN;
}

/** Whether a phone's Appearance names itself: while the page on screen (`room`) holds the bar with it named. A phone
 *  shows no page label, so the bar may take the page's whole width. */
export function appearanceNamed(room: number, b: TitleBarButtons): boolean {
  return room >= titleBarFixedRoom(b, true, true) - LABEL_GAP;
}
