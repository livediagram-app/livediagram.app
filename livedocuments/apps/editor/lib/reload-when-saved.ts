// Reloading for a new version without losing work (docs/specs/016-platform/new-version-prompt.md
// "The prompt"): wait until nothing edited is unsaved, checking locally (no request), then reload;
// give up after a bound rather than reload over unsaved changes.

/** How long "Reload" waits for the save to settle: the 600 ms autosave plus a slow save. */
export const RELOAD_SAVE_WAIT_MS = 10_000;
/** How often it checks while waiting: a local predicate, never a request. */
export const RELOAD_SAVE_POLL_MS = 200;

export function reloadWhenSaved(opts: {
  hasUnsavedChanges: () => boolean;
  reload: () => void;
  waitMs?: number;
  pollMs?: number;
}): Promise<'reloaded' | 'unsaved'> {
  const {
    hasUnsavedChanges,
    reload,
    waitMs = RELOAD_SAVE_WAIT_MS,
    pollMs = RELOAD_SAVE_POLL_MS,
  } = opts;
  return new Promise((resolve) => {
    let waited = 0;
    const check = () => {
      if (!hasUnsavedChanges()) {
        reload();
        resolve('reloaded');
        return;
      }
      if (waited >= waitMs) {
        console.warn('[document-format] reload waiting for unsaved changes', { waitedMs: waited });
        resolve('unsaved');
        return;
      }
      waited += pollMs;
      setTimeout(check, pollMs);
    };
    check();
  });
}
