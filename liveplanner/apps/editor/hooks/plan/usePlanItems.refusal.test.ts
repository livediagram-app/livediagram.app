import { describe, expect, it } from 'vitest';
import { ITEM_TITLE_MAX } from '@liveplanner/items';
import { PLAN_FULL_MESSAGE, refusalMessage, writeFailureMessage } from './usePlanItems';

// docs/specs/026-plan/items.md "Limits": a refused change names what was wrong.
describe('a refused change’s message', () => {
  it('names a too-long title with its limit, and falls back for the rest', () => {
    expect(refusalMessage('title_too_long')).toContain(String(ITEM_TITLE_MAX));
    expect(refusalMessage('fields_too_large')).toMatch(/too large/);
    expect(refusalMessage('something_new')).toBe('Couldn’t save the change to that card');
    expect(refusalMessage('something_new', '“Fix login”')).toBe(
      'Couldn’t save the change to “Fix login”',
    );
  });

  it('names the cap when a plan is full, and a named refusal or the generic line otherwise', () => {
    expect(writeFailureMessage({ code: 'items_full' })).toBe(
      'This plan already holds 5,000 cards, the most it can',
    );
    expect(writeFailureMessage({ code: 'title_too_long' })).toBe(refusalMessage('title_too_long'));
    expect(writeFailureMessage(new Error('offline'))).toBe('Couldn’t save the change to that card');
    expect(writeFailureMessage(null, undefined, '3 cards')).toBe(
      'Couldn’t save the change to 3 cards',
    );
  });

  it('names a field refused past its limit as the card shows it, and a full plan in plain words', () => {
    const refused = {
      code: 'field_value_invalid',
      field: 'f-solution',
      limit: { unit: 'characters', max: 10_000, given: 12_412 },
    };
    expect(writeFailureMessage(refused, () => 'Solution')).toBe(
      'Solution is 12,412 characters; the most is 10,000.',
    );
    // Without a name for it, the id; without a limit, the generic line for the code.
    expect(writeFailureMessage(refused)).toBe(
      'f-solution is 12,412 characters; the most is 10,000.',
    );
    expect(writeFailureMessage({ code: 'field_value_invalid', field: 'due' }, () => 'Due')).toBe(
      refusalMessage('field_value_invalid'),
    );
    expect(writeFailureMessage({ code: 'plan_full' })).toBe(PLAN_FULL_MESSAGE);
    expect(PLAN_FULL_MESSAGE).toBe(
      "This plan's cards are full: they hold 16 MB together, the most a plan can. Shorten long descriptions, " +
        'empty or delete cards, or start another plan',
    );
  });
});
