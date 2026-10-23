import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteTabSaved, whenTabSaved } from './tab-saved';

// A form's responses sheet waits for its new tab's save, so its create is
// never refused tab_not_found (issue #984).
afterEach(() => vi.useRealTimers());

describe('whenTabSaved', () => {
  it('waits for the tab’s save, then resolves true', async () => {
    let done: boolean | null = null;
    void whenTabSaved('doc1', 'tabA').then((v) => (done = v));
    await Promise.resolve();
    expect(done).toBeNull();
    noteTabSaved('doc1', 'tabA');
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('resolves at once for a tab already saved, and keeps designs and tabs apart', async () => {
    noteTabSaved('doc2', 'tabB');
    await expect(whenTabSaved('doc2', 'tabB')).resolves.toBe(true);
    vi.useFakeTimers();
    const other = whenTabSaved('doc3', 'tabB', 50);
    vi.advanceTimersByTime(50);
    await expect(other).resolves.toBe(false);
  });

  it('gives up after the wait, so a save that never comes still lets the create go', async () => {
    vi.useFakeTimers();
    const wait = whenTabSaved('doc4', 'tabC', 100);
    vi.advanceTimersByTime(99);
    noteTabSaved('elsewhere', 'tabC');
    vi.advanceTimersByTime(1);
    await expect(wait).resolves.toBe(false);
    // A save after the wait gave up wakes nothing and throws nothing.
    expect(() => noteTabSaved('doc4', 'tabC')).not.toThrow();
  });
});
