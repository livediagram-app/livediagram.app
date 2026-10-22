// "Open Settings on this category", from anywhere in the app, without a page
// navigation (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category).
// A link to a Settings category (a timeline token card, its menu verb) sits
// in code that holds none of the dialog's state, and the dialog is owned by
// whichever host is mounted (the Explorer or the editor). A window event keeps
// the two decoupled. Mail cannot raise it, so it links at the
// `?settings=<category>` deep link instead. The host side is
// hooks/ui/useOpenSettingsRequests.ts.
export const OPEN_SETTINGS_EVENT = 'livedesign:open-settings';

export function requestOpenSettings(categoryId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(OPEN_SETTINGS_EVENT, { detail: categoryId }));
}
