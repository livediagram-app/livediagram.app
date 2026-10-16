import { describe, expect, it, vi } from 'vitest';
import { openSearchWithPrefetch } from './open-search';

describe('openSearchWithPrefetch', () => {
  it('opens the panel and pulls in every tab not yet visited', () => {
    const setSearchOpen = vi.fn();
    const loadAllTabs = vi.fn(async () => {});
    openSearchWithPrefetch(setSearchOpen, loadAllTabs);
    expect(setSearchOpen).toHaveBeenCalledWith(true);
    expect(loadAllTabs).toHaveBeenCalledOnce();
  });
});
