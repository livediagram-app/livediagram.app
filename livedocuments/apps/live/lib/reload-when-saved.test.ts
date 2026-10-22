import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_SAVE_POLL_MS, RELOAD_SAVE_WAIT_MS, reloadWhenSaved } from './reload-when-saved';

// docs/specs/016-platform/new-version-prompt.md "The prompt": reload only once everything is saved.
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('reloadWhenSaved', () => {
  it('reloads at once when nothing is unsaved', async () => {
    const reload = vi.fn();
    await expect(reloadWhenSaved({ hasUnsavedChanges: () => false, reload })).resolves.toBe(
      'reloaded',
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits for the save to settle, then reloads', async () => {
    const reload = vi.fn();
    let unsaved = true;
    const done = reloadWhenSaved({ hasUnsavedChanges: () => unsaved, reload });
    await vi.advanceTimersByTimeAsync(RELOAD_SAVE_POLL_MS * 3);
    expect(reload).not.toHaveBeenCalled();
    unsaved = false;
    await vi.advanceTimersByTimeAsync(RELOAD_SAVE_POLL_MS);
    await expect(done).resolves.toBe('reloaded');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads while changes stay unsaved, and says so after the wait', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reload = vi.fn();
    const done = reloadWhenSaved({ hasUnsavedChanges: () => true, reload });
    await vi.advanceTimersByTimeAsync(RELOAD_SAVE_WAIT_MS + RELOAD_SAVE_POLL_MS);
    await expect(done).resolves.toBe('unsaved');
    expect(reload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[document-format] reload waiting for unsaved changes', {
      waitedMs: RELOAD_SAVE_WAIT_MS,
    });
  });

  it('waits ten seconds at most by default', () => {
    expect(RELOAD_SAVE_WAIT_MS).toBe(10_000);
    expect(RELOAD_SAVE_POLL_MS).toBe(200);
  });
});
