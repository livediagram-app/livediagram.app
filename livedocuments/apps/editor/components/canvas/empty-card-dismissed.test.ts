// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_CARD_DISMISSED_KEY,
  EMPTY_CARD_DISMISSED_MAX,
  dismissEmptyCard,
  emptyCardDismissed,
} from './empty-card-dismissed';

// start-diagramming.md: a closed start stays closed on that tab.
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

describe('bringing a closed card back', () => {
  it('reopens it, tells its readers, and survives a reload', async () => {
    const { dismissEmptyCard, emptyCardDismissed, restoreEmptyCard, subscribeEmptyCardDismissed } =
      await import('./empty-card-dismissed');
    let told = 0;
    const off = subscribeEmptyCardDismissed(() => told++);
    dismissEmptyCard('back:diagram');
    expect(emptyCardDismissed('back:diagram')).toBe(true);
    restoreEmptyCard('back:diagram');
    expect(emptyCardDismissed('back:diagram')).toBe(false);
    expect(localStorage.getItem('livedocuments:v2:empty-card-dismissed') ?? '').not.toContain(
      'back:diagram',
    );
    expect(told).toBe(2);
    off();
  });
});
