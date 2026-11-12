import { describe, expect, it } from 'vitest';
import { parseCollabDeepLink } from './collab-deep-link';

// The element deep link's parser (docs/specs/013-workspace/inbox.md §1): an old email's or Inbox row's link still
// selects its element.

describe('parseCollabDeepLink', () => {
  it('is null for the plain tab pin, an empty hash, or junk', () => {
    expect(parseCollabDeepLink('#t=tab-1')).toBeNull();
    expect(parseCollabDeepLink('')).toBeNull();
    expect(parseCollabDeepLink('#')).toBeNull();
    expect(parseCollabDeepLink('#el=only')).toBeNull();
    expect(parseCollabDeepLink('#garbage')).toBeNull();
  });

  it('accepts the fragment with or without the leading hash', () => {
    expect(parseCollabDeepLink('t=a&el=b&open=action')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: 'action',
    });
  });

  it('keeps the element but opens nothing for an unknown popover', () => {
    expect(parseCollabDeepLink('#t=a&el=b&open=sideways')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: null,
    });
    expect(parseCollabDeepLink('#t=a&el=b')).toEqual({
      at: { tabId: 'a', elementId: 'b' },
      open: null,
    });
  });
});
