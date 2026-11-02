// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseCollabDeepLink } from './collab-deep-link';
import { itemHref, newDocumentHref, shareUrl, teamsOfToken } from './explorer-host';

describe('explorer host', () => {
  it('copies a share link as the address whose page head names the canvas', () => {
    const url = shareUrl({ code: 'ABCD2345', itemId: 'p1' } as never, { id: 'p1' } as never);
    expect(url).toBe(`${window.location.origin}/document/shared?s=ABCD2345`);
  });

  it('opens a canvas here and another app’s item on its own site', () => {
    expect(itemHref({ id: 'p1', app: 'livehuddle', sharedVia: null } as never)).toBe(
      '/document/p1',
    );
    const elsewhere = itemHref({ id: 'd1', app: 'livedocuments', sharedVia: 'CODE' } as never);
    expect(elsewhere).toMatch(/^https?:\/\//);
    expect(elsewhere.endsWith('/d1?s=CODE')).toBe(true);
  });

  it('links an Inbox row the way the editor reads it back', () => {
    const doc = { id: 'p1', app: 'livehuddle', sharedVia: null } as never;
    const hashOf = (href: string) => href.slice(href.indexOf('#'));
    const action = itemHref(doc, { tabId: 't 1', elementId: 'e1', open: 'action' });
    expect(action).toBe('/document/p1#t=t+1&el=e1&open=action');
    expect(parseCollabDeepLink(hashOf(action))).toEqual({
      at: { tabId: 't 1', elementId: 'e1' },
      open: 'action',
    });
    // A tab: a plain tab pin.
    expect(itemHref(doc, { tabId: 'b1' })).toBe('/document/p1#t=b1');
  });

  it('files New where it was pressed', () => {
    expect(newDocumentHref(null)).toBe('/new');
    expect(newDocumentHref({ folderId: 'f1', teamId: null })).toBe('/new?folder=f1');
  });

  it('reads teams from a token, none from a guest or a bad one', () => {
    const claims = btoa(JSON.stringify({ teams: [{ id: 't1', name: 'Atlas' }, { id: 2 }] }));
    expect(teamsOfToken(`h.${claims}.s`)).toEqual([{ id: 't1', name: 'Atlas' }]);
    expect(teamsOfToken(null)).toEqual([]);
    expect(teamsOfToken('x.y.z')).toEqual([]);
  });
});

describe('explorer help', () => {
  it('gives each view its article, the Library pages included, and Invites none', async () => {
    const { explorerHelpHref } = await import('./explorer-host');
    expect(explorerHelpHref({ kind: 'home' })).toBe('/help/explorer/timeline/');
    expect(explorerHelpHref({ kind: 'gallery' })).toBe('/help/explorer/image-gallery/');
    expect(explorerHelpHref({ kind: 'shape-libraries' })).toBe('/help/explorer/shape-libraries/');
    expect(explorerHelpHref({ kind: 'invites' })).toBeUndefined();
  });
});
