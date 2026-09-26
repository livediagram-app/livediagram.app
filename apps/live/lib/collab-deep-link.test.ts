import { describe, expect, it } from 'vitest';
import type { ActivityPlace } from '@livediagram/api-schema';
import { collabDeepLinkHref, parseCollabDeepLink } from './collab-deep-link';

// Both halves of the element deep link (docs/specs/013-workspace/activity-page.md §1): the Explorer
// builds it, the editor reads it, and they share this module so the
// parameter names cannot drift. The round trip is the contract.

const place: ActivityPlace = {
  diagramId: 'd 1',
  diagramName: 'Payments',
  teamId: null,
  via: 'own',
  shareCode: null,
  tabId: 'tab/1',
  tabName: 'Flow',
  elementId: 'el&1',
  elementLabel: 'Checkout',
};

describe('collabDeepLinkHref', () => {
  it('builds the owned-diagram form with an encoded fragment', () => {
    expect(collabDeepLinkHref(place, 'action')).toBe(
      '/diagram/d%201#t=tab%2F1&el=el%261&open=action',
    );
  });

  it('uses the visitor URL for a diagram shared with the reader', () => {
    expect(collabDeepLinkHref({ ...place, via: 'shared', shareCode: 'c/1' }, 'comments')).toBe(
      '/diagram/d%201?s=c%2F1#t=tab%2F1&el=el%261&open=comments',
    );
  });

  it('never appends a share code to an owned or team diagram', () => {
    expect(
      collabDeepLinkHref({ ...place, via: 'team', shareCode: 'leak' }, 'action'),
    ).not.toContain('?s=');
  });

  it('round-trips through the parser', () => {
    const href = collabDeepLinkHref(place, 'comments');
    const hash = href.slice(href.indexOf('#'));
    expect(parseCollabDeepLink(hash)).toEqual({
      tabId: 'tab/1',
      elementId: 'el&1',
      open: 'comments',
    });
  });
});

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
      tabId: 'a',
      elementId: 'b',
      open: 'action',
    });
  });

  it('keeps the element but opens nothing for an unknown popover', () => {
    expect(parseCollabDeepLink('#t=a&el=b&open=sideways')).toEqual({
      tabId: 'a',
      elementId: 'b',
      open: null,
    });
    expect(parseCollabDeepLink('#t=a&el=b')).toEqual({ tabId: 'a', elementId: 'b', open: null });
  });
});
