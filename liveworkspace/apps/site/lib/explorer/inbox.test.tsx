import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';
import type { InboxTarget } from '@liveworkspace/explorer';
import { inboxActionsFor, inboxHost } from './inbox';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

describe('the Inbox on liveworkspace.app', () => {
  it('draws a Plan card type by its own glyph', () => {
    const type = ITEM_TYPES[0];
    const html = renderToStaticMarkup(<>{inboxHost.cardGlyph!(type.id)}</>);
    expect(html).toContain(`d="${planGlyphPath(type.glyph)}"`);
  });

  it('draws the plain card glyph for a type not built in', () => {
    const html = renderToStaticMarkup(<>{inboxHost.cardGlyph!('made-up')}</>);
    expect(html).toContain(`d="${planGlyphPath(undefined)}"`);
  });

  it('points the actions help at liveplanner', () => {
    expect(inboxHost.actionsHelpHref).toMatch(/\/help\/plan\/cards\/$/);
  });
});

const thread = (app: InboxTarget['app']): InboxTarget => ({
  kind: 'Thread',
  app,
  itemId: 'i1',
  tabId: 't1',
  elementId: 'e1',
  actionId: null,
  local: false,
});

describe('the Inbox’s verbs here', () => {
  it('replies to any app’s thread on liveworkspace.app, as the workspace token, with no cookies', async () => {
    const doFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const actions = inboxActionsFor(null, doFetch);
    for (const app of ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const)
      expect(actions.offers(thread(app))).toEqual(['reply', 'resolve']);
    await actions.reply!(thread('livedesign'), 'Yes');
    const [url, init = {}] = doFetch.mock.calls[0]!;
    expect(url).toMatch(/\/api\/designs\/i1\/tabs\/t1\/comments$/);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual({ elementId: 'e1', text: 'Yes' });
  });

  it('on an app’s own address, acts on that app’s threads only, and marks nothing done', () => {
    const actions = inboxActionsFor('livediagram');
    expect(actions.offers(thread('livediagram'))).toEqual(['reply', 'resolve']);
    expect(actions.offers(thread('liveplanner'))).toEqual([]);
    expect(actions.offers({ ...thread('livediagram'), kind: 'Action', actionId: 'a1' })).toEqual(
      [],
    );
    expect(actions.offers({ ...thread('livediagram'), local: true })).toEqual([]);
  });
});
