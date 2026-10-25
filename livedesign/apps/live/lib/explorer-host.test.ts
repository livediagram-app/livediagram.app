// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseCollabDeepLink } from './collab-deep-link';
import { itemHref, newDesignHref, shareUrl } from './explorer-host';

describe('explorer host', () => {
  it('copies a share link as the address whose page head names the design', () => {
    const url = shareUrl({ code: 'ABCD2345', itemId: 'p1' } as never, { id: 'p1' } as never);
    expect(url).toBe(`${window.location.origin}/design/shared?s=ABCD2345`);
  });

  it('opens a design here and another app’s item on its own site', () => {
    expect(itemHref({ id: 'p1', app: 'livedesign', sharedVia: null } as never)).toBe(
      '/design/p1',
    );
    const elsewhere = itemHref({ id: 'd1', app: 'livediagram', sharedVia: 'CODE' } as never);
    expect(elsewhere).toMatch(/^https?:\/\//);
    expect(elsewhere.endsWith('/d1?s=CODE')).toBe(true);
  });

  it('links an Inbox row the way the editor reads it back', () => {
    const design = { id: 'p1', app: 'livedesign', sharedVia: null } as never;
    const hashOf = (href: string) => href.slice(href.indexOf('#'));
    const action = itemHref(design, { tabId: 't 1', elementId: 'e1', open: 'action' });
    expect(action).toBe('/design/p1#t=t+1&el=e1&open=action');
    expect(parseCollabDeepLink(hashOf(action))).toEqual({
      at: { tabId: 't 1', elementId: 'e1' },
      open: 'action',
    });
    // A tab alone: a plain tab pin.
    expect(itemHref(design, { tabId: 'b1' })).toBe('/design/p1#t=b1');
  });

  it('files New where it was pressed', () => {
    expect(newDesignHref(null)).toBe('/new');
    expect(newDesignHref({ folderId: 'f1', teamId: null })).toBe('/new?folder=f1');
  });
});
