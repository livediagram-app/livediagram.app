import { describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

// The Explorer's Share offers the Community on the person's own spaces while the Community is on
// (docs/specs/025-community/community.md "Publishing"; docs/specs/013-workspace/share-roles.md): a signed-in
// account's, ready to publish, and a guest's, with Sign In to Share. A space shared with someone as an Editor, a
// Participant or a Viewer is never theirs to publish.

vi.mock('./community-share-host', () => ({
  livehuddleCommunityHost: (opts: { ownerId: string; documentId: string }) => ({
    ownerId: opts.ownerId,
    documentId: opts.documentId,
  }),
}));

import { explorerCommunity } from './explorer-community-host';

const account = { id: 'user_a', name: 'Ada' };
const item = (over: Partial<Item> = {}) =>
  ({
    id: 'd1',
    app: 'livehuddle',
    kind: 'document',
    title: 'Roadmap',
    ownerId: 'user_a',
    updatedAt: 7,
    ...over,
  }) as unknown as Item;

describe('explorerCommunity', () => {
  it("binds the tab to the account's own space", () => {
    const tab = explorerCommunity(account, true, null)!(item());
    expect(tab).toMatchObject({
      host: { ownerId: 'user_a', documentId: 'd1' },
      ownerId: 'user_a',
      documentName: 'Roadmap',
      signedIn: true,
      communityOn: true,
      author: { name: 'Ada' },
    });
    expect(String(tab?.signInHref)).toContain(encodeURIComponent('/document/d1'));
  });

  it('offers a guest the tab on their own space, signed out, to sign in from', () => {
    const tab = explorerCommunity(null, true, 'guest_g')!(item({ ownerId: 'guest_g' }));
    expect(tab).toMatchObject({
      host: { ownerId: 'guest_g', documentId: 'd1' },
      ownerId: 'guest_g',
      signedIn: false,
      author: { name: 'You' },
    });
    expect(String(tab?.signInHref)).toBe(
      `/sign-in/?redirect_url=${encodeURIComponent('/document/d1')}`,
    );
  });

  it("offers a guest nothing on someone else's space, or with no guest yet", () => {
    expect(explorerCommunity(null, true, 'guest_g')!(item())).toBeUndefined();
    expect(explorerCommunity(null, true, null)!(item())).toBeUndefined();
  });

  it.each(['edit', 'participate', 'view'])(
    'offers nothing on a space shared with them for %s',
    (level) => {
      const shared = item({ ownerId: 'user_b', sharedVia: { level } } as unknown as Partial<Item>);
      expect(explorerCommunity(account, true, null)!(shared)).toBeUndefined();
    },
  );

  it('offers nothing with the Community off, or on another app’s item', () => {
    expect(explorerCommunity(account, false, null)!(item())).toBeUndefined();
    expect(
      explorerCommunity(null, false, 'guest_g')!(item({ ownerId: 'guest_g' })),
    ).toBeUndefined();
    expect(
      explorerCommunity(account, true, null)!(item({ app: 'livediagram' } as Partial<Item>)),
    ).toBeUndefined();
  });

  it('names an account without a name You', () => {
    expect(explorerCommunity({ id: 'user_a', name: null }, true, null)!(item())?.author.name).toBe(
      'You',
    );
  });
});
