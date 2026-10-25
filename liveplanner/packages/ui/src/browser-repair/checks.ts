import { runBrowserChecks as runChecks, type BrowserChecks } from '@liveworkspace/ui';

// The browser checks (docs/specs/007-editor/load-recovery.md "Diagnostics"), @liveworkspace/ui's, with this
// product's own throwaway probe key and database.
export const BROWSER_CHECK_PROBE = 'liveplanner-probe';

/** Every check, in one go. */
export function runBrowserChecks(win: Window = window): Promise<BrowserChecks> {
  return runChecks(win, BROWSER_CHECK_PROBE);
}
