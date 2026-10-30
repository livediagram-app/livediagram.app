import { describe, expect, it } from 'vitest';
import {
  CARD_ENTRY_KEY,
  cardEntryState,
  cardHash,
  cardLink,
  hashCardId,
  isCardEntry,
} from './card-address';
import { parseCollabDeepLink } from './collab-deep-link';

// docs/specs/026-plan/plan-board.md "Its address": an open card rides beside the tab pin, in the Inbox's grammar.
describe('card address', () => {
  it('writes the tab pin alone, or with the open card', () => {
    expect(cardHash('t1', null)).toBe('#t=t1');
    expect(cardHash('t1', 'it-1')).toBe('#t=t1&item=it-1');
  });

  it('is read back by the deep link as a card to open', () => {
    expect(parseCollabDeepLink(cardHash('t1', 'it-1'))).toEqual({
      at: null,
      open: null,
      itemId: 'it-1',
    });
  });

  it('reads the card a fragment names', () => {
    expect(hashCardId('#t=t1&item=it-1')).toBe('it-1');
    expect(hashCardId('t=t1&item=it-1')).toBe('it-1');
    expect(hashCardId('#t=t1')).toBeNull();
    expect(hashCardId('#t=t1&item=')).toBeNull();
    expect(hashCardId('')).toBeNull();
  });

  it('marks the entry an opened card added, and keeps the router’s own keys out', () => {
    expect(cardEntryState(true)).toEqual({ [CARD_ENTRY_KEY]: true });
    expect(cardEntryState(false)).toEqual({});
    expect(isCardEntry({ [CARD_ENTRY_KEY]: true, __NA: true })).toBe(true);
    expect(isCardEntry({ __NA: true })).toBe(false);
    expect(isCardEntry({ [CARD_ENTRY_KEY]: 'yes' })).toBe(false);
    expect(isCardEntry(null)).toBe(false);
    expect(isCardEntry('card')).toBe(false);
  });

  it('copies the plan’s editor address with the card, keeping only the share code', () => {
    const base = {
      origin: 'https://www.liveplanner.app',
      projectId: 'p 1',
      tabId: 't1',
      itemId: 'it-1',
    };
    expect(cardLink({ ...base, search: '' })).toBe(
      'https://www.liveplanner.app/project/p%201#t=t1&item=it-1',
    );
    expect(cardLink({ ...base, search: '?s=ab/c&share=1' })).toBe(
      'https://www.liveplanner.app/project/p%201?s=ab%2Fc#t=t1&item=it-1',
    );
  });
});
