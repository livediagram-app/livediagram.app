import { describe, expect, it } from 'vitest';
import type { ActivityCard, ActivityPlace } from '@livediagram/api-schema';
import { cardDeepLinkHref, collabDeepLinkHref, parseCollabDeepLink } from './collab-deep-link';

// Both halves of the element deep link (docs/specs/013-workspace/activity-page.md §1): the Explorer
// builds it, the editor reads it, and they share this module so the
// parameter names cannot drift. The round trip is the contract.

const place: ActivityPlace = {
  documentId: 'd 1',
  documentName: 'Payments',
  teamId: null,
  via: 'own',
  shareCode: null,
  tabId: 'tab/1',
  tabName: 'Flow',
  elementId: 'el&1',
  elementLabel: 'Checkout',
};

describe('collabDeepLinkHref', () => {
  it('builds the owned-document form with an encoded fragment', () => {
    expect(collabDeepLinkHref(place, 'action')).toBe(
      '/document/d%201#t=tab%2F1&el=el%261&open=action',
    );
  });

  it('uses the visitor URL for a document shared with the reader', () => {
    expect(collabDeepLinkHref({ ...place, via: 'shared', shareCode: 'c/1' }, 'comments')).toBe(
      '/document/d%201?s=c%2F1#t=tab%2F1&el=el%261&open=comments',
    );
  });

  it('never appends a share code to an owned or team document', () => {
    expect(
      collabDeepLinkHref({ ...place, via: 'team', shareCode: 'leak' }, 'action'),
    ).not.toContain('?s=');
  });

  it('round-trips through the parser', () => {
    const href = collabDeepLinkHref(place, 'comments');
    const hash = href.slice(href.indexOf('#'));
    expect(parseCollabDeepLink(hash)).toEqual({
      at: { tabId: 'tab/1', elementId: 'el&1' },
      open: 'comments',
      itemId: null,
    });
  });
});

describe('cardDeepLinkHref', () => {
  const card: ActivityCard = {
    documentId: 'd1',
    documentName: 'Roadmap',
    teamId: null,
    via: 'own',
    shareCode: null,
    board: { tabId: 'tab/1', tabName: 'Plan', elementId: 'b1', title: 'Sprint' },
    id: 'it&1',
    key: 4,
    type: 'task',
    title: 'Write it',
    status: 'todo',
    updatedAt: 1,
  };

  it('lands on the card’s board and names the card, round-tripping', () => {
    const href = cardDeepLinkHref(card);
    expect(href).toBe('/document/d1#t=tab%2F1&el=b1&item=it%261');
    expect(parseCollabDeepLink(href.slice(href.indexOf('#')))).toEqual({
      at: { tabId: 'tab/1', elementId: 'b1' },
      open: null,
      itemId: 'it&1',
    });
  });

  it('names only the card when no board shows it, through the visitor URL when shared', () => {
    const href = cardDeepLinkHref({ ...card, board: null, via: 'shared', shareCode: 'c1' });
    expect(href).toBe('/document/d1?s=c1#item=it%261');
    expect(parseCollabDeepLink(href.slice(href.indexOf('#')))).toEqual({
      at: null,
      open: null,
      itemId: 'it&1',
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
