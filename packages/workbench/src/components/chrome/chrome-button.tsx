// Shared styling for the bottom-bar control cluster (ChromeControls +
// AppearanceToggle).
//
// `labelled` (the editor's tab bar) adds a text label beside each icon
// from `sm` up; below it the buttons stay square icon targets, since a
// phone's bar has no room for words (docs/specs/007-editor/editor-app.md).
export const CHROME_BTN =
  'relative touch-target ml-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export const CHROME_BTN_LABELLED = 'sm:gap-1.5 sm:px-2';

// The notification list and the light / dark switch, a pair 4px apart rather than the bar's 12px (the owner,
// 2026-11-20). A phone's tab bar leaves both out, so its tabs have that room (Work Tracker 1508; editor-app.md "Tab
// bar"): the theme is in Settings › Appearance, and a leaving toast, with no bell on screen to go to, fades where it
// is (toast-collapse.ts). `phone:` is each app's own variant (app/globals.css), which Tailwind finds here.
export const CHROME_PHONE_HIDDEN_PAIR = 'inline-flex shrink-0 items-center phone:hidden';

export function ChromeLabel({ show, children }: { show: boolean; children: string }) {
  return show ? <span className="hidden text-xs font-medium sm:inline">{children}</span> : null;
}
