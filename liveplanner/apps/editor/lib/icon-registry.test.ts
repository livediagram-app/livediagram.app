import { describe, expect, it } from 'vitest';
import {
  ensureIconCatalogs,
  getIconLoaded,
  isIconCatalogsLoaded,
  resolveIconArtLoaded,
  subscribeIconCatalogs,
} from '@liveworkspace/workbench/lib/icon-registry';
import { getIcon, PLACEHOLDER_ICON } from './icons';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';

// The registry is module-global state, and vitest isolates each test FILE
// into its own module graph — so this file (and only this file) can observe
// the pristine not-yet-loaded state. The `it` blocks run in declaration
// order within the single describe, walking the registry through its one
// state flip: pre-load → load → loaded. Don't reorder them.
describe('icon-registry load lifecycle', () => {
  it('starts unloaded: sync lookups are empty, placeholder + id set still answer', () => {
    expect(isIconCatalogsLoaded()).toBe(false);
    expect(getIconLoaded('server')).toBeUndefined();
    expect(resolveIconArtLoaded('aws-s3')).toBeUndefined();
    // The graceful-degradation contract before the chunk lands: line-art
    // lookups serve the placeholder (never blank) and the tech-id gate
    // answers exactly (it rides a first-load id set, not the async data).
    expect(getIcon('server')).toBe(PLACEHOLDER_ICON);
    expect(isTechIconId('aws-s3')).toBe(true);
    expect(isTechIconId('server')).toBe(false);
  });

  it('loads once, notifies subscribers, and memoizes the promise', async () => {
    let notified = 0;
    const unsubscribe = subscribeIconCatalogs(() => {
      notified += 1;
    });
    // Memoization: concurrent callers share the same in-flight promise.
    const first = ensureIconCatalogs();
    expect(ensureIconCatalogs()).toBe(first);
    await first;
    expect(isIconCatalogsLoaded()).toBe(true);
    // One state flip → exactly one notification.
    expect(notified).toBe(1);
    unsubscribe();
  });

  it('serves both catalogues after load', async () => {
    await ensureIconCatalogs();
    expect(getIconLoaded('server')?.id).toBe('server');
    expect(resolveIconArtLoaded('aws-s3')?.colored).toBe(true);
    // Unknown ids stay undefined even when loaded.
    expect(getIconLoaded('does-not-exist')).toBeUndefined();
    expect(resolveIconArtLoaded('does-not-exist')).toBeUndefined();
  });
});
