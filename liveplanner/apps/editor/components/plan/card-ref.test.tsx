// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cardRefIn, useCardRefById } from './card-ref';

// A card by its id and number alone (docs/specs/026-plan/item-types.md "Card number prefixes" "Across plans"): a run's
// or a thread's card the plan does not hold reads by the ref it carries, else "#12" (one stored before refs).
describe('useCardRefById', () => {
  it('names a card the plan lacks by the ref it carries, #N for one from before refs', () => {
    const { result } = renderHook(() => useCardRefById());
    expect(result.current({ id: 'gone', key: 12, ref: 'WI-12' })).toBe('WI-12');
    expect(result.current({ id: 'gone', key: 12 })).toBe('#12');
  });
});

describe('cardRefIn', () => {
  it('reads #N with no catalogue', () => {
    expect(cardRefIn(undefined)({ key: 3, type: 'task' })).toBe('#3');
  });
});
