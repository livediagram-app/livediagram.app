// Shared styling for the bottom-bar control cluster (ChromeControls +
// AppearanceToggle).
//
// `labelled` (the editor's tab bar) adds a text label beside each icon
// from `sm` up; below it the buttons stay square icon targets, since a
// phone's bar has no room for words (spec/07).
export const CHROME_BTN =
  'ml-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export const CHROME_BTN_LABELLED = 'sm:gap-1.5 sm:px-2';

export function ChromeLabel({ show, children }: { show: boolean; children: string }) {
  return show ? <span className="hidden text-xs font-medium sm:inline">{children}</span> : null;
}
