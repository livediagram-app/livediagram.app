// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_CARD_DISMISSED_KEY,
  EMPTY_CARD_DISMISSED_MAX,
  dismissEmptyCard,
  emptyCardDismissed,
} from './empty-card-dismissed';

// new-document-route.md "The empty-canvas hint": a closed card stays closed on that tab.
beforeEach(() => localStorage.clear());

describe('the empty-tab card’s dismissal', () => {
  it('remembers each closed tab, and only those', () => {
    dismissEmptyCard('a');
    expect(emptyCardDismissed('a')).toBe(true);
    expect(emptyCardDismissed('b')).toBe(false);
  });

  it('keeps the newest ids within its bound, and survives junk', () => {
    for (let i = 0; i <= EMPTY_CARD_DISMISSED_MAX; i++) dismissEmptyCard(`t${i}`);
    expect(emptyCardDismissed('t0')).toBe(false);
    expect(emptyCardDismissed(`t${EMPTY_CARD_DISMISSED_MAX}`)).toBe(true);
    localStorage.setItem(EMPTY_CARD_DISMISSED_KEY, '{oops');
    expect(emptyCardDismissed('x')).toBe(false);
  });
});
