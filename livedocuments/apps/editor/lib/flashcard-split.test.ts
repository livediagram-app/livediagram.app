// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_PAGES } from '@livedocuments/document';
import { cardOverflowNow, publishCardOverflow, useCardOverflow } from './flashcard-overflow-store';
import { CARD_SPLIT_REASON, cardSplitLabel } from './flashcard-split';

// docs/specs/007-editor/flashcards.md "Never flows".
describe('Split Onto a New Card', () => {
  it('names itself when it can split, else says why not', () => {
    expect(cardSplitLabel('ready')).toBe('Split Onto a New Card');
    expect(cardSplitLabel('one-paragraph')).toBe(CARD_SPLIT_REASON['one-paragraph']);
    expect(cardSplitLabel('page-limit')).toContain(String(MAX_PAGES));
  });
});

describe('the cards too long', () => {
  it('keeps each card’s first block past its foot, and tells its readers', () => {
    const { result } = renderHook(() => useCardOverflow('f1'));
    expect(result.current).toBeNull();
    act(() => publishCardOverflow('f1', 'b3'));
    expect(result.current).toBe('b3');
    expect(cardOverflowNow('f1')).toBe('b3');
    // The same again is no change.
    act(() => publishCardOverflow('f1', 'b3'));
    act(() => publishCardOverflow('f1', null));
    expect(result.current).toBeNull();
    expect(cardOverflowNow('f1')).toBeNull();
  });

  it('reads nothing for no card', () => {
    const { result, unmount } = renderHook(() => useCardOverflow(undefined));
    expect(result.current).toBeNull();
    unmount();
  });
});
