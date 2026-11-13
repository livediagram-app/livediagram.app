// What a movable panel's outside-tap counts as inside it (MovablePanel's `dismissOnOutside`), though portalled
// elsewhere: the dock button that toggles it, the tour popover beside it, its own menus, dialogs and confirms, and
// the scrim that closes it itself. A confirm (ConfirmPopover) is an alertdialog, so it is named by its own mark:
// without it a panel's Delete confirm unmounted on the press and its Delete never ran.
export const MOVABLE_PANEL_INSIDE = [
  '[data-dock-button]',
  '[data-tour-popover]',
  '[data-menu-surface]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-confirm-popover]',
  '[data-popover-scrim]',
].join(',');
