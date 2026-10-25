import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// /api/share/<code> (docs/specs/013-workspace/share-roles.md): the index resolves the code (an unknown, revoked or
// expired one, a canvas in the Trash and a share password are its refusals, passed on as it answers them), the
// canvas is read as the link opens it (the document read, which redacts for the reader and confines a tab-scoped
// link: routes/documents.ts), and a Community post's link opens read-only while the post is public. Recording the
// visit and telling the owner of a first one are the index's (routes/internal-items.ts `joined`).

const { resolveShare, handleDocuments, community, communityListing } = vi.hoisted(() => ({
  resolveShare: vi.fn(),
  handleDocuments: vi.fn(),
  community: vi.fn(),
  communityListing: vi.fn(),
}));
vi.mock('./index-adapters', async (original) => ({
  ...(await original<typeof import('./index-adapters')>()),
  clientFor: (ctx: { env: { NO_INDEX?: boolean } }) =>
    ctx.env.NO_INDEX ? new Response(null, { status: 503 }) : { resolveShare },
}));
vi.mock('./documents', () => ({ handleDocuments }));
vi.mock('../document-client', () => ({
  documentRoom: () => ({ community, communityListing }),
}));

import { handleShare } from './share';

const LISTING = { postId: 'post1', title: 'Payments flow', author: { name: 'Ada' } };

function call(
  path: string,
  opts: { method?: string; password?: string; owner?: string; env?: Partial<Env> } = {},
) {
  return handleShare(
    makeTestRouteContext(opts.method ?? 'GET', path, {
      env: (opts.env ?? {}) as Env,
      ...(opts.owner ? { owner: opts.owner } : {}),
      headers: opts.password !== undefined ? { 'X-Share-Password': opts.password } : {},
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  resolveShare.mockResolvedValue({ item: { id: 'd1' }, level: 'view', tabId: null });
  handleDocuments.mockImplementation(
    async () => new Response(JSON.stringify({ document: { id: 'd1', ownerId: '' } })),
  );
  community.mockResolvedValue(null);
  communityListing.mockResolvedValue(LISTING);
});

describe('the share router', () => {
  // A link's previews (image.svg, image.png, card) are liveworkspace's: the router sends them there
  // (liveworkspace/docs/previews.md), so here they are paths like any other.
  it('404s everything this surface does not answer, the previews included', async () => {
    for (const [method, path] of [
      ['POST', '/api/share/C'],
      ['GET', '/api/share'],
      ['GET', '/api/share/C/extra'],
      ['GET', '/api/share/C/image.svg'],
      ['GET', '/api/share/C/card'],
    ] as const) {
      expect((await call(path, { method })).status, `${method} ${path}`).toBe(404);
    }
    expect(resolveShare).not.toHaveBeenCalled();
  });
});

describe('GET /api/share/<code> (docs/specs/013-workspace/share-roles.md + docs/specs/013-workspace/share-password.md)', () => {
  it('resolves a live code to the document and the link’s own role', async () => {
    // The role travels with the LINK: a view code must not resolve to edit.
    const res = await call('/api/share/C');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      document: { id: 'd1', ownerId: '' },
      role: 'view',
      tabId: null,
    });
    expect(resolveShare).toHaveBeenCalledWith('C', null);
  });

  it('reads the canvas through the link, so the read redacts and scopes as the link opens it', async () => {
    await call('/api/share/C', { owner: 'visitor-1' });
    const [ctx] = handleDocuments.mock.calls[0]! as [
      { request: Request; segments: string[]; url: URL },
    ];
    expect(ctx.segments).toEqual(['api', 'documents', 'd1']);
    expect(ctx.url.pathname).toBe('/api/documents/d1');
    expect(ctx.request.method).toBe('GET');
    expect(ctx.request.headers.get('X-Share-Code')).toBe('C');
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md
  it('hands a tab-scoped visitor their tab', async () => {
    resolveShare.mockResolvedValue({ item: { id: 'd1' }, level: 'edit', tabId: 't2' });
    expect(await (await call('/api/share/C')).json()).toMatchObject({ role: 'edit', tabId: 't2' });
  });

  it('passes the share password on, and the index’s refusal back: 401 none sent, 403 a wrong one', async () => {
    resolveShare.mockRejectedValueOnce(new IndexError(401, 'password_required'));
    const none = await call('/api/share/C');
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual({ error: 'password_required' });
    resolveShare.mockRejectedValueOnce(new IndexError(403, 'password_invalid'));
    const wrong = await call('/api/share/C', { password: 'wrong' });
    expect(wrong.status).toBe(403);
    expect(resolveShare).toHaveBeenLastCalledWith('C', 'wrong');
    // A failed gate never reaches the canvas.
    expect(handleDocuments).not.toHaveBeenCalled();
  });

  it('404s a code with no live link: expired, revoked or never issued', async () => {
    resolveShare.mockRejectedValue(new IndexError(404, 'not_found'));
    expect((await call('/api/share/NOPE')).status).toBe(404);
    expect(handleDocuments).not.toHaveBeenCalled();
  });

  it('answers 503 without an index', async () => {
    expect((await call('/api/share/C', { env: { NO_INDEX: true } as never })).status).toBe(503);
  });

  it('passes on the read’s refusal when the canvas is gone', async () => {
    handleDocuments.mockResolvedValue(new Response(null, { status: 404 }));
    expect((await call('/api/share/C')).status).toBe(404);
  });

  describe("a Community post's link (docs/specs/025-community/community.md)", () => {
    beforeEach(() => community.mockResolvedValue({ code: 'C', open: true }));

    it('opens read-only on every tab, carrying the post', async () => {
      resolveShare.mockResolvedValue({ item: { id: 'd1' }, level: 'edit', tabId: 't2' });
      expect(await (await call('/api/share/C')).json()).toEqual({
        document: { id: 'd1', ownerId: '' },
        role: 'view',
        tabId: null,
        community: LISTING,
      });
      expect(communityListing).toHaveBeenCalledWith('C');
    });

    it('answers 404 and nothing else while the post is not public', async () => {
      community.mockResolvedValue({ code: 'C', open: false });
      expect((await call('/api/share/C')).status).toBe(404);
      expect(handleDocuments).not.toHaveBeenCalled();
    });

    it('answers 404 when the listing is gone by the time it is read', async () => {
      communityListing.mockResolvedValue(null);
      expect((await call('/api/share/C')).status).toBe(404);
    });

    it('treats another link on a canvas with a post as an ordinary link', async () => {
      community.mockResolvedValue({ code: 'OTHER', open: false });
      expect(await (await call('/api/share/C')).json()).toEqual({
        document: { id: 'd1', ownerId: '' },
        role: 'view',
        tabId: null,
      });
    });
  });
});
