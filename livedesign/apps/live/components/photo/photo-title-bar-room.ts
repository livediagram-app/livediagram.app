// The room a photo page's title-bar menus take (PhotoTitleBar), apart from the menus themselves so the
// page's title bar can budget for them without loading the photo editor.
// The title-bar room each menu takes: its icon, or its icon and name on a desktop.
const BUTTON_ROOM = 28;
const LABELLED_ROOM = 70;

export function photoTitleBarRoom(labelled: boolean): number {
  return 3 * (labelled ? LABELLED_ROOM : BUTTON_ROOM);
}
