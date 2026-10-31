import { describe, expect, it } from 'vitest';
import {
  ANNOUNCE,
  cardLabel,
  commentCount,
  deleteThreadMessage,
  resolvedByLabel,
  sharedBeyond,
  sharedLabel,
  openTally,
  titlePreview,
} from './thread-words';

// The words a card's threads say (docs/specs/026-plan/items.md "Where it shows").
describe('thread words', () => {
  it('counts', () => {
    expect(commentCount(1)).toBe('1 comment');
    expect(commentCount(4)).toBe('4 comments');
    expect(openTally(2)).toBe('2 Open');
    expect(openTally(1)).toBe('1 Open');
    expect(openTally(0)).toBe('');
    expect(sharedLabel(3)).toBe('On 3 cards');
  });

  it('names a card here and in another plan', () => {
    const titleOf = (id: string) => (id === 'a' ? 'Basket' : null);
    expect(cardLabel({ projectId: 'p', itemId: 'a', key: 12 }, 'p', titleOf)).toBe('#12 Basket');
    expect(cardLabel({ projectId: 'p', itemId: 'b', key: 3 }, 'p', titleOf)).toBe('#3');
    expect(
      cardLabel({ projectId: 'q', itemId: 'c', key: 4, projectName: 'Sprint 12' }, 'p', titleOf),
    ).toBe('#4 in Sprint 12');
    expect(cardLabel({ projectId: 'q', itemId: 'c', key: null }, 'p', titleOf)).toBe(
      'A card in another plan',
    );
    expect(sharedBeyond({ cards: [{ projectId: 'p', itemId: 'a', key: 1 }] }, 'p')).toBe(false);
    expect(sharedBeyond({ cards: [{ projectId: 'q', itemId: 'a', key: 1 }] }, 'p')).toBe(true);
  });

  it('confirms a delete by how many cards it goes from', () => {
    expect(deleteThreadMessage(3)).toBe(
      "Delete this thread? It is on 3 cards, and goes from all of them. This can't be undone.",
    );
    expect(deleteThreadMessage(1)).toBe(
      "Delete this thread? Its comments go with it. This can't be undone.",
    );
  });

  it('previews the title, names who resolved, and announces', () => {
    expect(titlePreview('Sam: Hi')).toBe('Titled “Sam: Hi”');
    expect(resolvedByLabel('Bo')).toBe('Resolved by Bo');
    expect(resolvedByLabel(undefined)).toBe('Resolved');
    expect(ANNOUNCE.added('#2')).toBe('Added to #2');
  });
});
