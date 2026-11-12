// Each page's title bar, laid out for the room it has on screen (CanvasPages): which buttons it shows, whether they
// are named, and what is left for the label and the empty page's layout invite.
import { offersPageKindChoice, type LaidOutPage } from '@livedesign/design';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { QuickStyleBarRoom, QuickStylePhoneRows } from '@/lib/quick-style-bar-slots';
import {
  appearanceNamed,
  LABEL_MIN,
  titleBarFixedRoom,
  titleBarNamed,
} from './page-title-bar-room';

// The empty page's layout button beside the cog: with its words, or just its icon.
export const INVITE_WIDE = 150;
export const INVITE_ICON = 30;

export function pageChromeLayout(
  page: LaidOutPage,
  {
    view,
    zoom,
    bare,
    mobile,
    quickStyleRoom,
    quickStylePhone,
  }: {
    view: PagesModeView;
    zoom: number;
    bare: boolean;
    mobile: boolean;
    quickStyleRoom: QuickStyleBarRoom | null;
    quickStylePhone: QuickStylePhoneRows | null;
  },
) {
  const { pages } = view;
  const edit = bare ? undefined : view.edit;
  // The label fits the page's on-screen width, less the title bar's buttons; too narrow, it
  // hides. The title bar's room on screen: the page's width at this zoom. The cog takes its
  // corner; an empty logo page's layout invite sits beside it, with its words while there is
  // room for them and the label, as an icon while there is room for that, else not at all.
  const room = page.rect.width * zoom;
  // A locked page offers nothing to add (docs/specs/007-editor/pages-mode.md
  // "Locking a page"): no Layouts, no layout invite, no kind choice.
  const locked = page.locked === true;
  // A wireframe page's Layouts and Background sit beside its cog, always; a locked page offers
  // neither.
  const pageButtons = !!edit && !locked && page.kind === 'wireframe';
  // A wireframe page's Device, first beside its Layouts (PageDeviceButton).
  const deviceButton = pageButtons && page.kind === 'wireframe';
  // A logo page's empty artboard invites its layouts (its panel's Layouts tab).
  const empty = !!edit && !locked && page.kind === 'logo' && edit.contentCount(page.id) === 0;
  // The first page, unchosen and empty, offers its kind first (FirstPageChoice).
  const choosing =
    !!edit && !bare && !locked && offersPageKindChoice(pages, page.id, edit.contentCount(page.id));
  const logoButtons = !!edit && page.kind === 'logo' && !!view.logo;
  // A photo page's Image, Select and Filter menus (PhotoTitleBar), for someone who may edit it.
  const photoButtons = !!edit && !locked && page.kind === 'photo' && !!view.photo?.canEdit;
  // The title bar's fixed buttons (the cog, the lock, a logo page's own and
  // a wireframe page's): the invite and the label share what they leave.
  const buttons = {
    edit: !!edit,
    locked,
    logo: logoButtons,
    photo: photoButtons,
    page: pageButtons,
    device: deviceButton,
    selected: mobile && quickStylePhone?.pageId === page.id && quickStylePhone.rows.length > 0,
  };
  // The buttons name themselves on a desktop while the page is wide enough on screen to hold
  // them named; zoomed out further they drop to their icons, as a phone shows them.
  const labelled = titleBarNamed(room, buttons, mobile);
  // A phone's Appearance is named while the page on screen holds it (appearanceNamed).
  const appearanceLabelled = mobile && appearanceNamed(room, buttons);
  const fixedRoom = titleBarFixedRoom(buttons, mobile ? appearanceLabelled : labelled, mobile);
  const invite =
    !empty || choosing
      ? null
      : !mobile && room - fixedRoom >= INVITE_WIDE + LABEL_MIN * 2
        ? 'wide'
        : room - fixedRoom >= INVITE_ICON + LABEL_MIN
          ? 'icon'
          : null;
  // A wireframe page's sheet is its device (WireframeDeviceSheet): the paint is its screen's.
  const device = page.kind === 'wireframe';
  const labelRoom =
    room -
    fixedRoom -
    (invite === 'wide' ? INVITE_WIDE : invite === 'icon' ? INVITE_ICON : 0) -
    (quickStyleRoom?.pageId === page.id ? quickStyleRoom.px : 0);
  return {
    locked,
    pageButtons,
    deviceButton,
    choosing,
    logoButtons,
    photoButtons,
    buttons,
    labelled,
    appearanceLabelled,
    invite,
    device,
    labelRoom,
  };
}
