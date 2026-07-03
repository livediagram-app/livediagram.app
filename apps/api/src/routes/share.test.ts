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
vi.mock('../thumbnail', () => ({
  getDiagramThumbnailSvg: vi.fn(),
  getDiagramTabImageSvg: vi.fn(),
}));

// Import AFTER the mock so the share.ts module picks up the stubbed
// db helpers. passwordGate is module-private to share.ts, exported
// only for this suite (see the comment on the export).
import { handleShare, passwordGate } from './share';
import { getDiagram, getShareLink } from '../db';
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
