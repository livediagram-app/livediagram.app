import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// `passwordGate` is the route-side helper that translates a
// password-protected diagram + visitor-supplied password into one of
// three outcomes: access allowed (null), `password_required` 401 (no
// password supplied yet), or `password_invalid` 403 (supplied the
// wrong one). The live editor's SharePasswordGate component
// distinguishes the two error codes verbatim, so a regression that
// swapped 401 and 403, or that changed the error body shape, would
// break the gate UI silently: a visitor who never entered a password
// would see "wrong password", or a wrong-password visitor would loop
// back to the prompt without an error message. These cases pin the
// mapping.
//
// `getDiagramSharePassword` is the only db helper the gate reaches
// for, so the mock factory below stubs it and the test drives the
// three branches by setting the stubbed return value per case.

const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
vi.mock('../db', () => ({
  // Real exports under '../db' that share.ts imports. Only
  // getDiagramSharePassword is consulted by passwordGate; the rest
  // need stub entries so the share.ts module can finish evaluating
  // its top-level imports.
  getDiagram: vi.fn(),
  getDiagramSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
  getShareLink: vi.fn(),
  getParticipant: vi.fn(),
  recordSharedAccess: vi.fn(),
}));

// The live-image endpoint (spec/54 + spec/67) delegates the actual
// render-cache to ./thumbnail; stub it so this suite pins the route's
// resolve + password-exclusion wiring, not the rendering.
vi.mock('../email/notifications', () => ({
  // spec/65's owner email: a seam here, tested for real in email/*.test.ts.
  notifyDiagramJoin: vi.fn(),
}));

// spec/22's server-side Diagram·Joined count: a seam, the insert itself is
// the shared server-telemetry helper.
vi.mock('../server-telemetry', () => ({
  reportServerEvent: vi.fn(async () => {}),
}));

vi.mock('../thumbnail', () => ({
  getDiagramThumbnailSvg: vi.fn(),
  getDiagramTabImageSvg: vi.fn(),
}));

// Import AFTER the mock so the share.ts module picks up the stubbed
// db helpers. passwordGate is module-private to share.ts, exported
// only for this suite (see the comment on the export).
import { handleShare, passwordGate } from './share';
import { getDiagram, getParticipant, getShareLink, recordSharedAccess } from '../db';
import { notifyDiagramJoin } from '../email/notifications';
import { reportServerEvent } from '../server-telemetry';
import { getDiagramTabImageSvg, getDiagramThumbnailSvg } from '../thumbnail';
import type { RouteContext } from './context';

const FAKE_ENV = {} as Env;

const getDiagramMock = vi.mocked(getDiagram);
const getShareLinkMock = vi.mocked(getShareLink);
const getThumbnailMock = vi.mocked(getDiagramThumbnailSvg);
const getTabImageMock = vi.mocked(getDiagramTabImageSvg);

function imageCtx(code: string, tab?: string): RouteContext {
  const url = new URL(`https://api.test/api/share/${code}/image.svg`);
  if (tab !== undefined) url.searchParams.set('tab', tab);
  return {
    request: new Request(url, { method: 'GET' }),
    env: FAKE_ENV,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    clerkUserId: null,
    verifiedUserId: null,
    clerkEmail: null,
    resolveOwner: () => null,
  };
}

function shareLink(diagramId: string) {
  return {
    code: 'C',
    diagramId,
    role: 'view' as const,
    createdAt: 0,
    expiry: 'never' as const,
    expiresAt: null,
  };
}

function diagram(id: string) {
  return {
    id,
    ownerId: 'o1',
    name: 'D',
    tabs: [],
    shareable: true,
    shareCode: 'C',
    folderId: null,
    teamId: null,
    source: null,
    presentation: null,
    savedAt: 1,
    createdAt: 0,
    ownerName: null,
    ownerColor: null,
  };
}

beforeEach(() => {
  getSharePasswordMock.mockReset();
});

describe('passwordGate (spec/24 status-code mapping)', () => {
  it('returns null when the diagram has no password (gate is a no-op)', async () => {
    getSharePasswordMock.mockResolvedValue(null);
    const result = await passwordGate(FAKE_ENV, 'diag-1', null);
    expect(result).toBeNull();
  });

  it('returns null when the diagram has no password and a password is supplied anyway', async () => {
    // The owner clears the password while a visitor is mid-session
    // still holding the old one. The gate must not reject them with
    // 403 here; "no password required" wins regardless of what they
    // sent.
    getSharePasswordMock.mockResolvedValue(null);
    const result = await passwordGate(FAKE_ENV, 'diag-2', 'leftover-from-old-session');
    expect(result).toBeNull();
  });

  it('returns 401 password_required when a password is set but the visitor supplied none', async () => {
    // SharePasswordGate distinguishes 401 (show the entry prompt
    // without an error message: the visitor hasn't tried yet) from
    // 403 (show "wrong password"). Swapping the two would surface a
    // confusing error to a first-time visitor.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-3', null);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    expect(await result!.json()).toEqual({ error: 'password_required' });
  });

  it('returns 403 password_invalid when the visitor supplied the wrong password', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-4', 'wrong');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(await result!.json()).toEqual({ error: 'password_invalid' });
  });

  it('returns null when the visitor supplied the exact matching password (allowed through)', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-5', 'hunter2');
    expect(result).toBeNull();
  });

  it('treats an empty-string password as a real attempt that fails (403, not 401)', async () => {
    // Edge case: the client could in principle send X-Share-Password
    // with an empty value (e.g. after the user clears the input).
    // That counts as "the visitor tried and got it wrong", not "the
    // visitor never tried" — passwordGate uses != null, so '' is
    // treated as an attempted-but-wrong password. Pins the boundary.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-6', '');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    expect(await result!.json()).toEqual({ error: 'password_invalid' });
  });

  it('does case-sensitive password comparison (off-by-one capitalisation 403s)', async () => {
    // Cheap regression guard: a future "normalize whitespace +
    // case" change to the comparison would be a security
    // weakening. Asserting case sensitivity here pins the contract.
    getSharePasswordMock.mockResolvedValue('Hunter2');
    const result = await passwordGate(FAKE_ENV, 'diag-7', 'hunter2');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

describe('GET /api/share/<code>/image.svg (spec/54 + spec/67 live image)', () => {
  beforeEach(() => {
    getDiagramMock.mockReset();
    getShareLinkMock.mockReset();
    getThumbnailMock.mockReset();
    getTabImageMock.mockReset();
    getSharePasswordMock.mockReset();
  });

  it('serves the cached SVG with a public stale-while-revalidate cache', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue(null);
    getThumbnailMock.mockResolvedValue('<svg>live</svg>');

    const res = await handleShare(imageCtx('C'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=300');
    expect(await res.text()).toBe('<svg>live</svg>');
  });

  it('404s a password-protected diagram WITHOUT rendering (an <img> cannot supply the password)', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue('hunter2');

    const res = await handleShare(imageCtx('C'));

    expect(res.status).toBe(404);
    // The security property: we never even reach the renderer for a
    // gated diagram, so no bytes can leak past the password gate.
    expect(getThumbnailMock).not.toHaveBeenCalled();
  });

  it('404s an unknown / revoked / expired share code', async () => {
    getShareLinkMock.mockResolvedValue(null);
    const res = await handleShare(imageCtx('NOPE'));
    expect(res.status).toBe(404);
    expect(getDiagramMock).not.toHaveBeenCalled();
  });

  it('404s when the link points at a diagram that no longer exists', async () => {
    // The link outliving its diagram is the shape a deleted-then-embedded
    // image takes; it must 404 rather than reach the render cache.
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(null);
    const res = await handleShare(imageCtx('C'));
    expect(res.status).toBe(404);
    expect(getThumbnailMock).not.toHaveBeenCalled();
  });

  it('404s an empty diagram (the render-cache yields no snapshot)', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue(null);
    getThumbnailMock.mockResolvedValue(null);

    const res = await handleShare(imageCtx('C'));
    expect(res.status).toBe(404);
  });

  it('renders the requested tab (not the cached snapshot) when ?tab= is present (spec/54)', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue(null);
    getTabImageMock.mockResolvedValue('<svg>tab2</svg>');

    const res = await handleShare(imageCtx('C', 'tab-2'));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<svg>tab2</svg>');
    // The per-tab path renders on read; the cached first-tab snapshot is
    // never touched for a ?tab= request.
    expect(getTabImageMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'tab-2');
    expect(getThumbnailMock).not.toHaveBeenCalled();
  });

  it('404s ?tab= with an unknown tab id (no cross-diagram leak) without falling back to tab one', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue(null);
    getTabImageMock.mockResolvedValue(null); // tab not in this diagram

    const res = await handleShare(imageCtx('C', 'other-diagrams-tab'));

    expect(res.status).toBe(404);
    // Must NOT quietly serve the first tab when the requested one is bogus.
    expect(getThumbnailMock).not.toHaveBeenCalled();
  });

  it('still 404s a password-protected diagram for a ?tab= request (gate before render)', async () => {
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue('hunter2');

    const res = await handleShare(imageCtx('C', 'tab-2'));

    expect(res.status).toBe(404);
    expect(getTabImageMock).not.toHaveBeenCalled();
  });
});

// The resolve itself: what a visitor landing on a share link gets back, and
// what the worker records about them. This is the only unauthenticated read
// path into a diagram, so each branch below is either "who may see this" or
// "what does the owner learn about who looked".
describe('GET /api/share/<code> (spec/24 + spec/65)', () => {
  const recordSharedAccessMock = vi.mocked(recordSharedAccess);
  const getParticipantMock = vi.mocked(getParticipant);
  const notifyDiagramJoinMock = vi.mocked(notifyDiagramJoin);
  const reportServerEventMock = vi.mocked(reportServerEvent);

  function resolveCtx(opts: { code?: string; visitor?: string | null; password?: string } = {}): {
    ctx: RouteContext;
    settled: () => Promise<unknown>;
  } {
    const url = new URL(`https://api.test/api/share/${opts.code ?? 'C'}`);
    const headers = new Headers();
    if (opts.password !== undefined) headers.set('X-Share-Password', opts.password);
    const dispatched: Promise<unknown>[] = [];
    return {
      ctx: {
        request: new Request(url, { method: 'GET', headers }),
        env: FAKE_ENV,
        url,
        segments: url.pathname.replace(/^\//, '').split('/'),
        clerkUserId: null,
        verifiedUserId: null,
        clerkEmail: null,
        resolveOwner: () => opts.visitor ?? null,
        waitUntil: (p: Promise<unknown>) => {
          dispatched.push(p);
        },
      },
      settled: () => Promise.all(dispatched),
    };
  }

  beforeEach(() => {
    getDiagramMock.mockReset();
    getShareLinkMock.mockReset();
    getSharePasswordMock.mockReset();
    recordSharedAccessMock.mockReset();
    getParticipantMock.mockReset();
    notifyDiagramJoinMock.mockReset();
    reportServerEventMock.mockClear();
    getShareLinkMock.mockResolvedValue(shareLink('d1'));
    getDiagramMock.mockResolvedValue(diagram('d1'));
    getSharePasswordMock.mockResolvedValue(null);
    recordSharedAccessMock.mockResolvedValue(false);
    getParticipantMock.mockResolvedValue(null);
  });

  it('resolves a live code to the diagram and the link’s own role', async () => {
    // The role travels with the LINK, not the diagram: a view code must not
    // resolve to edit just because the diagram is shareable.
    getShareLinkMock.mockResolvedValue({ ...shareLink('d1'), role: 'view' });
    const { ctx } = resolveCtx();
    const res = await handleShare(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ role: 'view', diagram: { id: 'd1' } });
  });

  it('blanks the owner id for everyone but the owner', async () => {
    // A guest's owner-id is a bearer value: an observer who learns it could
    // once claim that guest's diagrams via /api/migrate. A visitor never
    // needs it — the client only compares it to decide isOwner.
    const { ctx } = resolveCtx({ visitor: 'someone-else' });
    const body = (await (await handleShare(ctx)).json()) as { diagram: { ownerId: string } };
    expect(body.diagram.ownerId).toBe('');
  });

  it('shows the owner their own id when they open their own link', async () => {
    const { ctx } = resolveCtx({ visitor: 'o1' });
    const body = (await (await handleShare(ctx)).json()) as { diagram: { ownerId: string } };
    expect(body.diagram.ownerId).toBe('o1');
    // ...and an owner opening their own link must not appear in their own
    // "Shared with you" list.
    expect(recordSharedAccessMock).not.toHaveBeenCalled();
  });

  it('records the visit for an identified non-owner, at the link’s role', async () => {
    const { ctx } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    expect(recordSharedAccessMock).toHaveBeenCalledWith(FAKE_ENV, 'visitor-1', 'd1', 'view');
  });

  it('records nothing for a visitor who never identifies', async () => {
    const { ctx } = resolveCtx({ visitor: null });
    expect((await handleShare(ctx)).status).toBe(200);
    expect(recordSharedAccessMock).not.toHaveBeenCalled();
  });

  it('emails the owner on a first visit, with the joiner’s display name', async () => {
    recordSharedAccessMock.mockResolvedValue(true);
    getParticipantMock.mockResolvedValue({
      id: 'visitor-1',
      name: 'Ada',
      color: '#f00',
      createdAt: 0,
    });
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    await settled();
    expect(notifyDiagramJoinMock).toHaveBeenCalledWith(FAKE_ENV, expect.anything(), 'Ada');
  });

  it('stays quiet on a repeat visit', async () => {
    // spec/65 is once per person, not once per reload.
    recordSharedAccessMock.mockResolvedValue(false);
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    await settled();
    expect(notifyDiagramJoinMock).not.toHaveBeenCalled();
  });

  it('counts Diagram·Joined once, on the first visit, at the link’s role (spec/22)', async () => {
    recordSharedAccessMock.mockResolvedValue(true);
    getShareLinkMock.mockResolvedValue({ ...shareLink('d1'), role: 'edit' });
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    await settled();
    expect(reportServerEventMock).toHaveBeenCalledTimes(1);
    expect(reportServerEventMock).toHaveBeenCalledWith(FAKE_ENV, 'Diagram', 'Joined', 'Edit');
  });

  it('does not count Diagram·Joined on a refresh or return visit (spec/22)', async () => {
    // The editor used to emit on every open of the share URL; a reload
    // inflated "Collaborators Joined" roughly twofold.
    recordSharedAccessMock.mockResolvedValue(false);
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    await settled();
    expect(reportServerEventMock).not.toHaveBeenCalled();
  });

  it('does not count Diagram·Joined for the owner or an unidentified visitor', async () => {
    recordSharedAccessMock.mockResolvedValue(true);
    for (const visitor of ['o1', null]) {
      const { ctx, settled } = resolveCtx({ visitor });
      await handleShare(ctx);
      await settled();
    }
    expect(reportServerEventMock).not.toHaveBeenCalled();
  });

  it('still emails when the joiner has no participant record', async () => {
    recordSharedAccessMock.mockResolvedValue(true);
    getParticipantMock.mockRejectedValue(new Error('D1 down'));
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    await handleShare(ctx);
    await settled();
    expect(notifyDiagramJoinMock).toHaveBeenCalledWith(FAKE_ENV, expect.anything(), null);
  });

  it('resolves the code even when the tracking write fails', async () => {
    // Opening the link is the user-visible thing; the shared_with row is a
    // nice-to-have and must never turn a working link into an error.
    recordSharedAccessMock.mockRejectedValue(new Error('D1 down'));
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    expect((await handleShare(ctx)).status).toBe(200);
    await settled();
    expect(notifyDiagramJoinMock).not.toHaveBeenCalled();
  });

  it('swallows a failing notification rather than surfacing it', async () => {
    recordSharedAccessMock.mockResolvedValue(true);
    notifyDiagramJoinMock.mockRejectedValue(new Error('Resend down'));
    const { ctx, settled } = resolveCtx({ visitor: 'visitor-1' });
    expect((await handleShare(ctx)).status).toBe(200);
    await expect(settled()).resolves.toBeDefined();
  });

  it('gates on the password before recording anything', async () => {
    // A failed gate must not seed the "Shared with you" list — otherwise a
    // wrong guess leaves a listing entry behind.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const { ctx } = resolveCtx({ visitor: 'visitor-1' });
    const res = await handleShare(ctx);
    expect(res.status).toBe(401);
    expect(recordSharedAccessMock).not.toHaveBeenCalled();
  });

  it('403s a wrong password without resolving the diagram', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    const { ctx } = resolveCtx({ visitor: 'visitor-1', password: 'wrong' });
    expect((await handleShare(ctx)).status).toBe(403);
    expect(recordSharedAccessMock).not.toHaveBeenCalled();
  });

  it('404s a code with no live link — expired, revoked or never issued', async () => {
    // There is deliberately no `diagrams.shareable` fallback here: one used to
    // resolve ANY code on a shareable diagram at a hardcoded 'edit', which was
    // both an expiry bypass and a view→edit escalation.
    getShareLinkMock.mockResolvedValue(null);
    expect((await handleShare(resolveCtx().ctx)).status).toBe(404);
  });

  it('404s when the link points at a diagram that is gone', async () => {
    getDiagramMock.mockResolvedValue(null);
    expect((await handleShare(resolveCtx().ctx)).status).toBe(404);
  });

  it('404s everything this surface does not answer', async () => {
    for (const [method, path] of [
      ['POST', '/api/share/C'],
      ['GET', '/api/share'],
      ['GET', '/api/share/C/extra'],
      ['GET', '/api/diagrams/d1'],
    ] as const) {
      const url = new URL(`https://api.test${path}`);
      const res = await handleShare({
        request: new Request(url, { method }),
        env: FAKE_ENV,
        url,
        segments: url.pathname.replace(/^\//, '').split('/'),
        clerkUserId: null,
        verifiedUserId: null,
        clerkEmail: null,
        resolveOwner: () => null,
      });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });
});
