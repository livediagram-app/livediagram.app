// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markShareAfterSync, takeShareAfterSync } from './share-after-sync';

// docs/specs/006-document/offline-mode.md "Sharing a guest's Local only document": the reopen is one-shot
// and belongs to the document that synced.
describe('share after sync', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reopens Share once for the document that synced', () => {
    markShareAfterSync('doc-1');
    expect(takeShareAfterSync('doc-1')).toBe(true);
    expect(takeShareAfterSync('doc-1')).toBe(false);
  });

  it('never fires for another document, and clears the stale flag', () => {
    markShareAfterSync('doc-1');
    expect(takeShareAfterSync('doc-2')).toBe(false);
    expect(takeShareAfterSync('doc-1')).toBe(false);
  });

  it('answers no when nothing was asked', () => {
    expect(takeShareAfterSync('doc-1')).toBe(false);
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markShareAfterSync('doc-1')).not.toThrow();
    expect(takeShareAfterSync('doc-1')).toBe(false);
  });
});
