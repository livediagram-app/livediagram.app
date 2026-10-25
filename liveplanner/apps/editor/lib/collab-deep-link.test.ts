import { describe, expect, it } from 'vitest';
import { parseCollabDeepLink } from './collab-deep-link';

// The editor's half of the element deep link (docs/specs/013-workspace/inbox.md §1): the shared Explorer builds it,
// the editor reads it back.

describe('parseCollabDeepLink', () => {
  it('reads an encoded element link with its popover', () => {
    expect(parseCollabDeepLink('#t=tab%2F1&el=el%261&open=comments')).toEqual({
      at: { tabId: 'tab/1', elementId: 'el&1' },
      open: 'comments',
      itemId: null,
    });
  });

  it('reads a card on its board, and a card no board shows', () => {
    expect(parseCollabDeepLink('#t=tab%2F1&el=b1&item=it%261')).toEqual({
      at: { tabId: 'tab/1', elementId: 'b1' },
      open: null,
      itemId: 'it&1',
    });
    expect(parseCollabDeepLink('#item=it%261')).toEqual({ at: null, open: null, itemId: 'it&1' });
  });
});

describe('parseCollabDeepLink', () => {
  it('is null for the plain tab pin, an empty hash, or junk', () => {
    expect(parseCollabDeepLink('#t=tab-1')).toBeNull();
    expect(parseCollabDeepLink('')).toBeNull();
    expect(parseCollabDeepLink('#')).toBeNull();
    expect(parseCollabDeepLink('#el=only')).toBeNull();
    expect(parseCollabDeepLink('#garbage')).toBeNull();
    expect(parseCollabDeepLink('#t=a&item=')).toBeNull();
  });

  it('accepts the fragment with or without the leading hash', () => {
    expect(parseCollabDeepLink('t=a&el=b&open=action')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: 'action',
      itemId: null,
    });
  });

  it('keeps the element but opens nothing for an unknown popover', () => {
    expect(parseCollabDeepLink('#t=a&el=b&open=sideways')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: null,
      itemId: null,
    });
    expect(parseCollabDeepLink('#t=a&el=b')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: null,
      itemId: null,
    });
  });
});
