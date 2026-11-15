import { describe, expect, it } from 'vitest';
import { ITEM_TITLE_MAX } from '@liveplanner/items';
import { refusalMessage, writeFailureMessage } from './usePlanItems';

// docs/specs/026-plan/items.md "Limits": a refused change names what was wrong.
describe('a refused change’s message', () => {
  it('names a too-long title with its limit, and falls back for the rest', () => {
    expect(refusalMessage('title_too_long')).toContain(String(ITEM_TITLE_MAX));
    expect(refusalMessage('fields_too_large')).toMatch(/too large/);
    expect(refusalMessage('something_new')).toBe("Couldn't save that change");
  });

  it('names the cap when a plan is full, and a named refusal or the generic line otherwise', () => {
    expect(writeFailureMessage({ code: 'items_full' })).toBe(
      'This plan already holds 5,000 cards, the most it can',
    );
    expect(writeFailureMessage({ code: 'title_too_long' })).toBe(refusalMessage('title_too_long'));
    expect(writeFailureMessage(new Error('offline'))).toBe("Couldn't save that change");
    expect(writeFailureMessage(null)).toBe("Couldn't save that change");
  });
});
