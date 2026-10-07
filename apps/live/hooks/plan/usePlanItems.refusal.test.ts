import { describe, expect, it } from 'vitest';
import { ITEM_TITLE_MAX } from '@livediagram/items';
import { refusalMessage } from './usePlanItems';

// docs/specs/026-plan/items.md "Limits": a refused change names what was wrong.
describe('a refused change’s message', () => {
  it('names a too-long title with its limit, and falls back for the rest', () => {
    expect(refusalMessage('title_too_long')).toContain(String(ITEM_TITLE_MAX));
    expect(refusalMessage('fields_too_large')).toMatch(/too large/);
    expect(refusalMessage('something_new')).toBe("Couldn't save that change");
  });
});
