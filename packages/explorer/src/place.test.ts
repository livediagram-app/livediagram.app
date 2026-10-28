import { describe, expect, it } from 'vitest';
import { placeHash } from './place';

describe('placeHash', () => {
  it('writes the editors’ deep link for each kind of Inbox row', () => {
    expect(placeHash()).toBe('');
    expect(placeHash({ tabId: 't1' })).toBe('#t=t1');
    expect(placeHash({ tabId: 't 1', elementId: 'e1', open: 'comments' })).toBe(
      '#t=t+1&el=e1&open=comments',
    );
    expect(placeHash({ tabId: 't1', elementId: 'b1', cardId: 'c1' })).toBe('#t=t1&el=b1&item=c1');
    expect(placeHash({ cardId: 'c1', open: 'action' })).toBe('#item=c1');
    // One of a card's threads opens on the card; a thread with no card names nothing.
    expect(placeHash({ cardId: 'c1', threadId: 'th-1' })).toBe('#item=c1&thread=th-1');
    expect(placeHash({ threadId: 'th-1' })).toBe('');
  });
});
