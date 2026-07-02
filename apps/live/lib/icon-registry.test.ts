import { describe, expect, it } from 'vitest';
import {
  ensureIconCatalogs,
  getIconLoaded,
  getLoadedIconCatalog,
  getLoadedTechIconCatalog,
  getTechIconLoaded,
  isIconCatalogsLoaded,
  subscribeIconCatalogs,
} from './icon-registry';
import { getIcon, PLACEHOLDER_ICON } from './icons';
import { isTechIconId } from './tech-icons';

// The registry is module-global state, and vitest isolates each test FILE
// into its own module graph — so this file (and only this file) can observe
// the pristine not-yet-loaded state. The `it` blocks run in declaration
// order within the single describe, walking the registry through its one
// state flip: pre-load → load → loaded. Don't reorder them.
describe('icon-registry load lifecycle', () => {
  it('starts unloaded: sync lookups are empty, placeholder + id set still answer', () => {
    expect(isIconCatalogsLoaded()).toBe(false);
    expect(getIconLoaded('server')).toBeUndefined();
    expect(getTechIconLoaded('aws-s3')).toBeUndefined();
    expect(getLoadedIconCatalog()).toEqual([]);
    expect(getLoadedTechIconCatalog()).toEqual([]);
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

  it('serves both catalogues after load, with line-art order preserved', async () => {
    await ensureIconCatalogs();
    expect(getIconLoaded('server')?.id).toBe('server');
    expect(getTechIconLoaded('aws-s3')?.label).toBe('S3');
    const icons = getLoadedIconCatalog();
    expect(icons.length).toBeGreaterThan(0);
    // Part 1 leads part 2, so index 0 is still the catalogue's default icon.
    expect(icons[0]?.id).toBe('user');
    expect(getLoadedTechIconCatalog().length).toBeGreaterThan(0);
    // Unknown ids stay undefined even when loaded.
    expect(getIconLoaded('does-not-exist')).toBeUndefined();
    expect(getTechIconLoaded('does-not-exist')).toBeUndefined();
  });
});
