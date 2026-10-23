import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignDTO } from '../types';

// Characterisation tests for handleDesigns' authorisation surface.
// designs.ts is the security-critical resource: every owner-only and
// share-gated path resolves the caller, loads the design, and maps the
// outcome onto one specific status code:
//   - no resolvable owner            -> 400 (missingAuth)
//   - design missing                -> 404 (no existence leak)
//   - owner mismatch (owner-only)    -> 403 (forbidden)
//   - share gate denies (gated read/ -> 403
//     edit paths)
//   - success with no body           -> 204
// These cases pin that mapping across one representative route per
// guard shape, so the requireOwner / requireOwnedDesign
// extraction can't silently swap a 403 for a 404
// (which would leak existence) or drop a missingAuth (which would let
// an unauthenticated caller through).

// vi.mock factories are hoisted above the module's top-level consts, so
// the mock fns have to be created inside vi.hoisted to exist by the time
// the factories run.
const { db, canReadDesign, canEditDesign, resolveDesignGrant } = vi.hoisted(() => ({
  db: {
    listDesignsByOwner: vi.fn(),
    getDesign: vi.fn(),
    // The save's own one-query read (db/tab-save-design.ts); answered from getDesign's mock below.
    getDesignForSave: vi.fn(),
    getShareLink: vi.fn(async () => null),
    // The thumbnail route's one-query gate + freshness read.
    getDesignThumbMeta: vi.fn(),
    upsertDesignMeta: vi.fn(),
    deleteDesign: vi.fn(),
    // The Trash (docs/specs/013-workspace/trash.md): a plain delete trashes.
    trashDesign: vi.fn(async () => true),
    purgeDesigns: vi.fn(async () => 1),
    getTrashedDesignMeta: vi.fn(async () => null),
    getFolder: vi.fn(),
    setDesignFolder: vi.fn(),
    getMembership: vi.fn(),
    // Needed by the placement route since leaving a team library became its own
    // event: it reads the outgoing team's name for the bubble.
    getTeam: vi.fn(async () => ({ id: 'team-1', name: 'Design' })),
    getTab: vi.fn(),
    tabBelongsElsewhere: vi.fn(async () => false),
    upsertTab: vi.fn(),
    // The tab PUT writes at the revision it read and merges unseen changesets
    // (docs/specs/024-agents/agent-changesets.md); none are recorded here.
    upsertTabAtRev: vi.fn(),
    isTabRevStale: vi.fn(),
    changesetMergePages: vi.fn(),
    getParticipant: vi.fn(),
    // Share-link create / extend surface (docs/specs/013-workspace/share-link-expiry.md).
    createShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'CODE2345'),
    getShareLinkIncludingExpired: vi.fn(),
    extendShareLink: vi.fn(),
    // Every share-link change withdraws the design's standing
    // `share_link_expiring` warning (docs/specs/013-workspace/timeline.md §4.5); the retraction itself is
    // covered in expiry-retraction.test.ts.
    retractTimelineWarning: vi.fn(),
    // Slide deck write (docs/specs/012-collaboration/presentation-mode.md).
    setDesignPresentation: vi.fn(),
    reorderTabs: vi.fn(),
    // Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md).
    copyDesign: vi.fn(),
    listSharedWith: vi.fn(),
    deleteTabRow: vi.fn(),
    deleteShareLinksForTab: vi.fn(async (): Promise<string[]> => []),
    deleteFormLinksForTab: vi.fn(async (): Promise<number> => 0),
    // No live form links: a deleted tab unpublishes no form here (forms.test.ts covers it).
    liveFormLinksOf: vi.fn(async () => []),
    rescopeShareLink: vi.fn(),
  },
  // gateRead / gateEdit (context.ts) forward to these; mocking the auth
  // module lets each case drive "allowed" / "denied" directly.
  canReadDesign: vi.fn(),
  canEditDesign: vi.fn(),
  // gateGrant (context.ts) forwards here. Defaults (beforeEach) to what the
  // two gates above answer for an unscoped caller, so a case driving
  // allow / deny through them reaches the scope-aware doors too.
  resolveDesignGrant: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('../auth/design-access', () => ({
  canReadDesign,
  canEditDesign,
  resolveDesignGrant,
}));

// The thumbnail route (docs/specs/006-design/design-snapshots.md) delegates rendering to ./thumbnail; stub
// it so these cases pin the ACCESS GATE, and can assert the renderer is
// never reached for a denied caller (no render, no info leak).
const { getDesignThumbnailSvg, getDesignTabImageSvg } = vi.hoisted(() => ({
  getDesignThumbnailSvg: vi.fn(),
  getDesignTabImageSvg: vi.fn(),
}));
vi.mock('../thumbnail', () => ({ getDesignThumbnailSvg, getDesignTabImageSvg }));
// The share password (docs/specs/013-workspace/share-password.md): met unless a case says otherwise.
const { sharePasswordOk } = vi.hoisted(() => ({ sharePasswordOk: vi.fn(async () => true) }));
vi.mock('../auth/share-access', () => ({ sharePasswordOk }));

import type { RouteContext } from './context';
import { handleDesigns } from './designs';

// Guest-shaped context ('owner-1') with optional account identity + headers.
const makeCtx = (
  method: string,
  path: string,
  opts: {
    owner?: string | null;
    accountUserId?: string | null;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    headers: opts.headers,
    accountUserId: opts.accountUserId,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

// Minimal DesignDTO good enough for the authz branches under test.
function fakeDesign(ownerId: string, teamId: string | null = null): DesignDTO {
  return { id: 'd1', ownerId, teamId, name: 'Doc', tabs: [] } as unknown as DesignDTO;
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.setDesignFolder.mockResolvedValue(true);
  db.getDesignForSave.mockImplementation(async (...args: unknown[]) => {
    const doc = (await db.getDesign(...args)) as DesignDTO | null;
    return doc ? { ...doc, tabCount: doc.tabs?.length ?? 0 } : null;
  });
  canReadDesign.mockReset();
  canEditDesign.mockReset();
  resolveDesignGrant.mockReset();
  resolveDesignGrant.mockImplementation(async (...args: unknown[]) => {
    if (await canEditDesign(...args)) return { role: 'edit', tabScope: null };
    if (await canReadDesign(...args)) return { role: 'view', tabScope: null };
    return null;
  });
  getDesignThumbnailSvg.mockReset();
  getDesignTabImageSvg.mockReset();
});

describe('GET /designs/:id/thumbnail (docs/specs/006-design/design-snapshots.md access gate)', () => {
  it('404s an anonymous caller with no owner / share code / team — and never renders', async () => {
    db.getDesignThumbMeta.mockResolvedValue(fakeDesign('someone-else'));
    canReadDesign.mockResolvedValue(false);
    const res = await handleDesigns(
      makeCtx('GET', '/api/designs/d1/thumbnail', { owner: null }),
    );
    expect(res.status).toBe(404);
    // The security property: a denied caller never reaches the renderer,
    // so no snapshot bytes can leak past the gate.
    expect(getDesignThumbnailSvg).not.toHaveBeenCalled();
  });

  it('404s a known owner id that fails the read gate (not theirs, no share, no team)', async () => {
    db.getDesignThumbMeta.mockResolvedValue(fakeDesign('someone-else'));
    canReadDesign.mockResolvedValue(false);
    const res = await handleDesigns(
      makeCtx('GET', '/api/designs/d1/thumbnail', { owner: 'intruder' }),
    );
    expect(res.status).toBe(404);
    expect(getDesignThumbnailSvg).not.toHaveBeenCalled();
  });

  it('404s a missing design (no existence leak)', async () => {
    db.getDesignThumbMeta.mockResolvedValue(null);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/thumbnail'));
    expect(res.status).toBe(404);
    expect(canReadDesign).not.toHaveBeenCalled();
  });

  it('serves the SVG to a caller the read gate allows (owner / share / team)', async () => {
    db.getDesignThumbMeta.mockResolvedValue(fakeDesign('owner-1'));
    canReadDesign.mockResolvedValue(true);
    getDesignThumbnailSvg.mockResolvedValue('<svg>ok</svg>');
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/thumbnail'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(await res.text()).toBe('<svg>ok</svg>');
  });

  it('404s when access is allowed but there is no snapshot (empty design / no R2)', async () => {
    db.getDesignThumbMeta.mockResolvedValue(fakeDesign('owner-1'));
    canReadDesign.mockResolvedValue(true);
    getDesignThumbnailSvg.mockResolvedValue(null);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/thumbnail'));
    expect(res.status).toBe(404);
    // Past the gate and versioned by `?v=<savedAt>`, so the browser keeps it
    // rather than re-asking on every Explorer visit.
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
  });

  it('never marks an access-denied 404 cacheable', async () => {
    db.getDesignThumbMeta.mockResolvedValue(fakeDesign('someone-else'));
    canReadDesign.mockResolvedValue(false);
    const res = await handleDesigns(
      makeCtx('GET', '/api/designs/d1/thumbnail', { owner: 'intruder' }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });
});

describe('handleDesigns owner-only paths (DELETE /designs/:id)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('404 when the design does not exist (no existence leak)', async () => {
    db.getDesign.mockResolvedValue(null);
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1'));
    expect(res.status).toBe(404);
  });

  it('403 when the caller is not the owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('someone-else'));
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1'));
    expect(res.status).toBe(403);
    expect(db.deleteDesign).not.toHaveBeenCalled();
  });

  it('204 and moves it to the Trash when the caller owns the design', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1'));
    expect(res.status).toBe(204);
    expect(db.trashDesign).toHaveBeenCalledWith({}, 'd1', expect.any(Number));
    expect(db.deleteDesign).not.toHaveBeenCalled();
  });
});

describe('a body that is not a JSON object', () => {
  it('is a 400 on the metadata PUT and the whole-tab autosave, never a 500', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    for (const path of ['/api/designs/d1', '/api/designs/d1/tabs/t1']) {
      const notJson = makeTestRouteContext('PUT', path, { owner: 'owner-1', rawBody: '{nope' });
      expect((await handleDesigns(notJson)).status).toBe(400);
      const nul = makeTestRouteContext('PUT', path, { owner: 'owner-1', rawBody: 'null' });
      expect((await handleDesigns(nul)).status).toBe(400);
    }
  });
});

describe('handleDesigns metadata PUT (PUT /designs/:id)', () => {
  // Slide deck (docs/specs/012-collaboration/presentation-mode.md). The deck rides the metadata PUT but has its own
  // write, so an ordinary rename can never rewrite it.
  it('leaves the stored deck alone when the field is absent', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    await handleDesigns(makeCtx('PUT', '/api/designs/d1', { body: { name: 'Renamed' } }));
    expect(db.setDesignPresentation).not.toHaveBeenCalled();
  });

  it('writes the deck when one is sent', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    const deck = JSON.stringify({ decks: [{ slides: [] }] });
    await handleDesigns(makeCtx('PUT', '/api/designs/d1', { body: { presentation: deck } }));
    expect(db.setDesignPresentation).toHaveBeenCalledWith({}, 'd1', deck);
  });

  it('blanks ownerId in the response for an edit-role share visitor (docs/specs/014-identity/auth-and-guest-access.md)', async () => {
    // gateEdit admits an edit-role share code, so the PUT reply reaches the
    // same audience the GET redacts for.
    db.getDesign.mockResolvedValue(fakeDesign('0f5ca4af-9a8a-4a60-be5e-1179e5555880'));
    canEditDesign.mockResolvedValue(true);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1', {
        owner: 'visitor-1',
        body: { name: 'Doc' },
        headers: { 'X-Share-Code': 'CODE1234' },
      }),
    );
    expect(res.status).toBe(200);
    const { design: liveDoc } = (await res.json()) as { design: DesignDTO };
    expect(liveDoc.ownerId).toBe('');
  });

  it('returns the real ownerId to the owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1', { body: { name: 'Doc' } }),
    );
    const { design: liveDoc } = (await res.json()) as { design: DesignDTO };
    expect(liveDoc.ownerId).toBe('owner-1');
  });

  it('clears the deck on an explicit null', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    await handleDesigns(makeCtx('PUT', '/api/designs/d1', { body: { presentation: null } }));
    expect(db.setDesignPresentation).toHaveBeenCalledWith({}, 'd1', null);
  });

  it('400s a deck past the size cap, without writing', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    const huge = 'x'.repeat(256 * 1024 + 1);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1', { body: { presentation: huge } }),
    );
    expect(res.status).toBe(400);
    expect(db.setDesignPresentation).not.toHaveBeenCalled();
  });

  it('404s an unknown id instead of create-on-first-write (ghost-row guard)', async () => {
    // A stray meta write for an id the server has never seen (e.g. an
    // Offline Mode design id leaking past the client dispatch, docs/specs/006-design/offline-mode.md)
    // must NOT mint a zero-tab design row. Designs are created via POST.
    db.getDesign.mockResolvedValue(null);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1', { body: { name: 'Ghost' } }),
    );
    expect(res.status).toBe(404);
    expect(db.upsertDesignMeta).not.toHaveBeenCalled();
  });
});

describe('handleDesigns list (GET /designs)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleDesigns(makeCtx('GET', '/api/designs', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 with the owner-scoped list', async () => {
    db.listDesignsByOwner.mockResolvedValue([{ id: 'd1' }]);
    const res = await handleDesigns(makeCtx('GET', '/api/designs'));
    expect(res.status).toBe(200);
    expect(db.listDesignsByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });
});

describe('GET /designs/:id owner-id redaction (docs/specs/014-identity/auth-and-guest-access.md)', () => {
  // The DTO's ownerId is a credential: for a guest owner it is the
  // X-Owner-Id bearer value, and /api/migrate moves that owner's whole
  // workspace to whoever presents it. The share-code resolver has always
  // blanked it; this door reaches the same DTO for the same audience (the
  // read gate admits any valid share code, view or edit) and used to hand
  // it over intact.
  const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

  it('blanks ownerId for a share-code visitor', async () => {
    db.getDesign.mockResolvedValue(fakeDesign(GUEST));
    canReadDesign.mockResolvedValue(true);
    const res = await handleDesigns(
      makeCtx('GET', '/api/designs/d1', {
        owner: 'visitor-1',
        headers: { 'X-Share-Code': 'CODE1234' },
      }),
    );
    expect(res.status).toBe(200);
    const { design: liveDoc } = (await res.json()) as { design: DesignDTO };
    expect(liveDoc.ownerId).toBe('');
    // The visitor still gets the design itself — redaction, not refusal.
    expect(liveDoc.id).toBe('d1');
    expect(liveDoc.name).toBe('Doc');
  });

  it('returns the real ownerId to the owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canReadDesign.mockResolvedValue(true);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1'));
    const { design: liveDoc } = (await res.json()) as { design: DesignDTO };
    expect(liveDoc.ownerId).toBe('owner-1');
  });

  it('blanks it for a joined team member, who is not the owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('user_owner', 'team-1'));
    canReadDesign.mockResolvedValue(true);
    const res = await handleDesigns(
      makeCtx('GET', '/api/designs/d1', { owner: 'user_member', accountUserId: 'user_member' }),
    );
    const { design: liveDoc } = (await res.json()) as { design: DesignDTO };
    // No regression for them: a teammate already computed isOwner=false from
    // the real id, so they lose nothing they were using.
    expect(liveDoc.ownerId).toBe('');
  });

  it('still 404s a denied reader (redaction is not the gate)', async () => {
    db.getDesign.mockResolvedValue(fakeDesign(GUEST));
    canReadDesign.mockResolvedValue(false);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1', { owner: 'stranger' }));
    expect(res.status).toBe(404);
  });
});

describe('handleDesigns folder assignment (PUT /designs/:id/folder)', () => {
  it('403 on owner mismatch', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('someone-else'));
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(403);
  });

  it('204 when the owner clears the folder', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(204);
    // 5th arg (newOwnerId) is undefined: a personal move keeps the owner.
    expect(db.setDesignFolder).toHaveBeenCalledWith({}, 'd1', null, null, undefined);
  });

  // docs/specs/013-workspace/team-shared-designs.md: a team design belongs to every joined member, so any of
  // them may move it out into their OWN personal library — and doing so
  // transfers ownership to the mover (folders are owner-scoped).
  it('transfers ownership when a joined member moves a team design out to their folder', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-2', 'team-1'));
    db.getMembership.mockResolvedValue({ status: 'joined', role: 'member' });
    db.getFolder.mockResolvedValue({ id: 'f1', teamId: null, ownerId: 'member-1' });
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/folder', {
        owner: 'member-1',
        accountUserId: 'member-1',
        body: { folderId: 'f1', teamId: null },
      }),
    );
    expect(res.status).toBe(204);
    expect(db.setDesignFolder).toHaveBeenCalledWith({}, 'd1', 'f1', null, 'member-1');
  });

  it('403 when a non-member tries to move a team design out', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-2', 'team-1'));
    db.getMembership.mockResolvedValue(undefined);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/folder', {
        owner: 'stranger',
        accountUserId: 'stranger',
        body: { folderId: null, teamId: null },
      }),
    );
    expect(res.status).toBe(403);
    expect(db.setDesignFolder).not.toHaveBeenCalled();
  });
});

describe('handleDesigns gated tab read (GET /designs/:id/tabs/:tabId)', () => {
  it('404 when the design is missing', async () => {
    db.getDesign.mockResolvedValue(null);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/tabs/t1'));
    expect(res.status).toBe(404);
  });

  it('403 when the read gate denies the visitor', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('someone-else'));
    canReadDesign.mockResolvedValue(false);
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/tabs/t1'));
    expect(res.status).toBe(403);
  });

  it('200 when the read gate allows and the tab exists', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canReadDesign.mockResolvedValue(true);
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', elements: [] });
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/tabs/t1'));
    expect(res.status).toBe(200);
  });
});

describe('handleDesigns share-link expiry (docs/specs/013-workspace/share-link-expiry.md)', () => {
  const link = {
    code: 'CODE2345',
    designId: 'd1',
    role: 'edit',
    createdAt: 1,
    expiry: 'week',
    expiresAt: 2,
  };

  // The top-level beforeEach mockReset() wipes implementations, so the
  // code generator gets re-pinned here for the create-path asserts.
  beforeEach(() => {
    db.generateShareCode.mockReturnValue('CODE2345');
  });

  it('POST /designs/:id/share forwards a valid expiry choice', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    db.createShareLink.mockResolvedValue(link);
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/share', { body: { role: 'edit', expiry: 'week' } }),
    );
    expect(res.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'edit', 'week', null);
  });

  it('POST /designs/:id/share defaults unknown / missing expiry to never', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    db.createShareLink.mockResolvedValue({ ...link, expiry: 'never', expiresAt: null });
    await handleDesigns(
      makeCtx('POST', '/api/designs/d1/share', { body: { role: 'view', expiry: 'fortnight' } }),
    );
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'view', 'never', null);
  });

  it('extend re-arms an expiring link for the owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue(link);
    db.extendShareLink.mockResolvedValue({ ...link, expiresAt: 99 });
    const res = await handleDesigns(makeCtx('POST', '/api/designs/d1/share/CODE2345/extend'));
    expect(res.status).toBe(200);
    expect(db.extendShareLink).toHaveBeenCalledWith({}, 'CODE2345');
  });

  it('extend 404s when the code belongs to a different design', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, designId: 'other' });
    const res = await handleDesigns(makeCtx('POST', '/api/designs/d1/share/CODE2345/extend'));
    expect(res.status).toBe(404);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });

  it('extend 400s on a never-expiring link (nothing to extend)', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, expiry: 'never' });
    db.extendShareLink.mockResolvedValue(null);
    const res = await handleDesigns(makeCtx('POST', '/api/designs/d1/share/CODE2345/extend'));
    expect(res.status).toBe(400);
  });

  it('extend 403s for a non-owner', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('someone-else'));
    const res = await handleDesigns(makeCtx('POST', '/api/designs/d1/share/CODE2345/extend'));
    expect(res.status).toBe(403);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });
});

describe('handleDesigns tab-content data-loss backstop (PUT /designs/:id/tabs/:tabId)', () => {
  // Build a valid tab body from id stubs — these tests exercise the
  // data-loss backstop (empty vs non-empty), so the element CONTENT only has
  // to pass the structural gate (isValidTab); a real square per id does.
  const el = (id: string) => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
  });
  const tabBody = (elements: { id: string }[]) => ({
    id: 't1',
    name: 'Tab',
    elements: elements.map((e) => el(e.id)),
  });

  beforeEach(() => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    canEditDesign.mockResolvedValue(true);
    db.getParticipant.mockResolvedValue(null); // skip comment-author rewrite
    db.upsertTabAtRev.mockResolvedValue(1);
    db.changesetMergePages.mockImplementation(async function* () {});
  });

  it('413s an oversized tab that arrives without a Content-Length header', async () => {
    // The regression this exists for. `headers.get` returns null when the
    // header is absent and `Number(null)` is 0 — which IS finite, so an
    // isFinite-only check measured a chunked upload as zero bytes and let it
    // straight through. Nothing else bounds this route: index.ts's outer gate
    // is a Content-Length check too and defers here for the rest. A Request
    // built with a body carries no Content-Length, so this is the real shape.
    db.getTab.mockResolvedValue(null);
    // One structurally valid element carrying a 5 MB label: isValidTab caps
    // element COUNT and specific typed fields, not a generic label, so this
    // clears the schema gate and only the byte cap stands between it and D1.
    const base = tabBody([{ id: 'e1' }]);
    const huge = {
      ...base,
      elements: [{ ...base.elements[0], label: 'a'.repeat(5 * 1024 * 1024) }],
    };
    const res = await handleDesigns(makeCtx('PUT', '/api/designs/d1/tabs/t1', { body: huge }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    expect(db.upsertTabAtRev).not.toHaveBeenCalled();
  });

  it('413s using the declared Content-Length without re-stringifying', async () => {
    // The fast path the cap is written around: one PUT per ~600ms per editor,
    // so a trusted header skips a 4 MB stringify + encode. A small body with a
    // large declared length still trips it.
    db.getTab.mockResolvedValue(null);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', {
        body: tabBody([{ id: 'e1' }]),
        headers: { 'Content-Length': String(5 * 1024 * 1024) },
      }),
    );
    expect(res.status).toBe(413);
    expect(db.upsertTabAtRev).not.toHaveBeenCalled();
  });

  it('writes an ordinary tab that declares no Content-Length', async () => {
    // The other side of the fallback: making it reachable must not start
    // rejecting the normal case, which is every request the editor sends.
    db.getTab.mockResolvedValue(null);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', { body: tabBody([{ id: 'e1' }]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('409s and does NOT write when an empty body would blank a tab that has content', async () => {
    // The wipe shape: a never-loaded placeholder PUTs `{ elements: [] }`
    // over a real row, with no X-Allow-Empty header.
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', { body: tabBody([]) }),
    );
    expect(res.status).toBe(409);
    expect(db.upsertTabAtRev).not.toHaveBeenCalled();
  });

  it('allows the empty write when the client marks it intentional (X-Allow-Empty: 1)', async () => {
    // A real reset-canvas / delete-all on the loaded tab sends the header.
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', {
        body: tabBody([]),
        headers: { 'X-Allow-Empty': '1' },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('allows an empty write over an already-empty (or new) row — nothing to lose', async () => {
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [] });
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', { body: tabBody([]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('allows a non-empty write over a tab with content (the normal save path)', async () => {
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/tabs/t1', { body: tabBody([{ id: 'e2' }]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });
});

describe('POST /designs carrying an Offline Mode sync (docs/specs/006-design/offline-mode.md)', () => {
  // The offline record is deleted once the create succeeds, so the deck and
  // folder have to arrive with it.
  const create = (body: Record<string, unknown>) =>
    handleDesigns(
      makeCtx('POST', '/api/designs', { body: { id: 'd1', name: 'Doc', ...body } }),
    );
  const stored = () => db.upsertDesignMeta.mock.calls[0]![1] as Record<string, unknown>;

  it('stores the deck it was sent', async () => {
    db.getDesign.mockResolvedValue(null);
    await create({ presentation: '{"decks":[]}' });
    expect(stored().presentation).toBe('{"decks":[]}');
  });

  it("keeps a folder that is the caller's own personal folder", async () => {
    db.getDesign.mockResolvedValue(null);
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1', teamId: null });
    await create({ folderId: 'f1' });
    expect(stored().folderId).toBe('f1');
  });

  it("refuses a folder that isn't theirs by name, writing nothing", async () => {
    // docs/specs/013-workspace/folders.md "Placement on create": never filed elsewhere instead.
    // The sync itself refiles at the root on this refusal (lib/offline/offline-convert.ts).
    db.getDesign.mockResolvedValue(null);
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'someone-else', teamId: null });
    const res = await create({ folderId: 'f1' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'folder_not_found' });
    expect(db.upsertDesignMeta).not.toHaveBeenCalled();
  });
});

// docs/specs/015-api/api.md "Design dates": an imported board keeps its own dates.
describe('POST /designs carrying its own dates', () => {
  const create = (body: Record<string, unknown>) =>
    handleDesigns(
      makeCtx('POST', '/api/designs', { body: { id: 'd1', name: 'Doc', ...body } }),
    );
  const stored = () => db.upsertDesignMeta.mock.calls[0]![1] as Record<string, unknown>;
  const createdAt = Date.UTC(2020, 7, 14);
  const savedAt = Date.UTC(2021, 1, 3);

  it('stores the board’s created and modified dates', async () => {
    db.getDesign.mockResolvedValue(null);
    const res = await create({ createdAt, savedAt });
    expect(res.status).toBe(201);
    expect(stored()).toMatchObject({ createdAt, savedAt });
  });

  it('refuses invalid dates whole, writing nothing', async () => {
    db.getDesign.mockResolvedValue(null);
    for (const body of [
      { createdAt: '2020-08-14' },
      { createdAt: Date.UTC(1999, 11, 31) },
      { createdAt: Date.now() + 3 * 86_400_000 },
      { createdAt: savedAt, savedAt: createdAt },
      { savedAt },
    ]) {
      const res = await create(body);
      expect(res.status).toBe(400);
    }
    expect(db.upsertDesignMeta).not.toHaveBeenCalled();
  });

  it('modifies a re-committed design now, whatever dates it sends', async () => {
    db.getDesign.mockResolvedValue(fakeDesign('owner-1'));
    const before = Date.now();
    await create({ createdAt, savedAt });
    expect(stored().savedAt as number).toBeGreaterThanOrEqual(before);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md. A visitor on a link scoped to tab t2: every door either
// narrows to t2 or refuses.
describe('a tab-scoped visitor', () => {
  const scopedDesign = () =>
    ({
      ...fakeDesign('owner-1'),
      presentation: '{"slides":[]}',
      tabs: [
        { id: 't1', designId: 'd1', name: 'Pricing', orderIndex: 0, updatedAt: 1 },
        { id: 't2', designId: 'd1', name: 'Roadmap', orderIndex: 1, updatedAt: 1 },
      ],
    }) as unknown as DesignDTO;
  const visitor = { owner: 'visitor-1', headers: { 'X-Share-Code': 'SCOPED23' } };

  beforeEach(() => {
    db.getDesign.mockResolvedValue(scopedDesign());
    db.getDesignThumbMeta.mockResolvedValue(scopedDesign());
    resolveDesignGrant.mockResolvedValue({ role: 'edit', tabScope: 't2' });
  });

  it('gets the design with every other tab locked and no deck', async () => {
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1', visitor));
    const body = (await res.json()) as { design: DesignDTO };
    expect(body.design.tabs.map((t) => t.name)).toEqual(['', 'Roadmap']);
    expect(body.design.presentation).toBeNull();
  });

  it("gets its tab's image as the thumbnail, never the first tab's", async () => {
    getDesignTabImageSvg.mockResolvedValue('<svg>t2</svg>');
    const res = await handleDesigns(makeCtx('GET', '/api/designs/d1/thumbnail', visitor));
    expect(await res.text()).toBe('<svg>t2</svg>');
    expect(getDesignTabImageSvg).toHaveBeenCalledWith(expect.anything(), expect.anything(), 't2');
    expect(getDesignThumbnailSvg).not.toHaveBeenCalled();
  });

  it('names the tab it touches, so the gate can confine it', async () => {
    // Reading: the grant's tab scope opens its own tab and no other.
    db.getTab.mockResolvedValue({ id: 't2', name: 'Roadmap', elements: [] });
    const own = await handleDesigns(makeCtx('GET', '/api/designs/d1/tabs/t2', visitor));
    expect(own.status).toBe(200);
    const other = await handleDesigns(makeCtx('GET', '/api/designs/d1/tabs/t1', visitor));
    expect(other.status).toBe(404);
    canEditDesign.mockResolvedValue(true);
    await handleDesigns(makeCtx('PUT', '/api/designs/d1/tabs/t2', { ...visitor, body: {} }));
    expect(canEditDesign.mock.calls.at(-1)?.at(-1)).toBe('t2');
  });

  it('cannot delete the tab its link is scoped to', async () => {
    canEditDesign.mockResolvedValue(true);
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1/tabs/t2', visitor));
    expect(res.status).toBe(403);
    expect(db.deleteTabRow).not.toHaveBeenCalled();
  });

  it('copies its tab only', async () => {
    db.copyDesign.mockResolvedValue({ id: 'd2' });
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/copy', { ...visitor, body: {} }),
    );
    expect(res.status).toBe(201);
    expect(db.copyDesign.mock.calls[0]?.at(5)).toBe('t2');
  });

  it('copies with a JSON null body as with none, never a 500', async () => {
    db.copyDesign.mockResolvedValue({ id: 'd2' });
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/copy', { ...visitor, body: null }),
    );
    expect(res.status).toBe(201);
  });

  it('copies its tab only through its Shared-with-you row too', async () => {
    resolveDesignGrant.mockResolvedValue(null);
    db.listSharedWith.mockResolvedValue([{ id: 'd1', tabId: 't2' }]);
    db.copyDesign.mockResolvedValue({ id: 'd2' });
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/copy', { owner: 'visitor-1', body: {} }),
    );
    expect(res.status).toBe(201);
    expect(db.copyDesign.mock.calls[0]?.at(5)).toBe('t2');
    // A visitor's copy carries no one else's comment author ids.
    expect(db.copyDesign.mock.calls[0]?.at(6)).toBe('visitor-1');
  });

  it('refuses a Shared-with-you copy without the share password', async () => {
    resolveDesignGrant.mockResolvedValue(null);
    db.listSharedWith.mockResolvedValue([{ id: 'd1', tabId: null }]);
    sharePasswordOk.mockResolvedValueOnce(false);
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/copy', { owner: 'visitor-1', body: {} }),
    );
    expect(res.status).toBe(403);
    expect(db.copyDesign).not.toHaveBeenCalled();
  });
});

describe('deleting a tab (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
  const withTabs = (...ids: string[]) =>
    ({ ...fakeDesign('owner-1'), tabs: ids.map((id) => ({ id })) }) as unknown as DesignDTO;

  it('refuses a tab the design does not have, and the last tab for a token', async () => {
    canEditDesign.mockResolvedValue(true);
    db.getDesign.mockResolvedValue(withTabs('t1', 't2'));
    expect((await handleDesigns(makeCtx('DELETE', '/api/designs/d1/tabs/nope'))).status).toBe(
      404,
    );
    db.getDesign.mockResolvedValue(withTabs('t1'));
    const agent = makeTestRouteContext('DELETE', '/api/designs/d1/tabs/t1', {
      owner: 'owner-1',
      token: { id: 'tok' },
    });
    const res = await handleDesigns(agent);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_tab' });
    expect(db.deleteTabRow).not.toHaveBeenCalled();
    // The editor's own delete races its save of the new tab: let through.
    expect((await handleDesigns(makeCtx('DELETE', '/api/designs/d1/tabs/t1'))).status).toBe(
      204,
    );
  });

  it('takes the links scoped to it along', async () => {
    db.getDesign.mockResolvedValue(withTabs('t1', 't2'));
    canEditDesign.mockResolvedValue(true);
    db.deleteShareLinksForTab.mockResolvedValue(['AAAA2222']);
    const res = await handleDesigns(makeCtx('DELETE', '/api/designs/d1/tabs/t2'));
    expect(res.status).toBe(204);
    expect(db.deleteTabRow).toHaveBeenCalledWith(expect.anything(), 'd1', 't2');
    expect(db.deleteShareLinksForTab).toHaveBeenCalledWith(expect.anything(), 'd1', 't2');
  });
});

describe('share-link scope (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
  const twoTabs = () =>
    ({
      ...fakeDesign('owner-1'),
      tabs: [
        { id: 't1', designId: 'd1', name: 'A', orderIndex: 0, updatedAt: 1 },
        { id: 't2', designId: 'd1', name: 'B', orderIndex: 1, updatedAt: 1 },
      ],
    }) as unknown as DesignDTO;
  const link = (over: Record<string, unknown> = {}) => ({
    code: 'CODE2345',
    designId: 'd1',
    role: 'view',
    createdAt: 1,
    expiry: 'never',
    expiresAt: null,
    tabId: null,
    ...over,
  });

  beforeEach(() => {
    db.getDesign.mockResolvedValue(twoTabs());
    db.generateShareCode.mockReturnValue('CODE2345');
  });

  it('mints a link scoped to one of the design tabs', async () => {
    db.createShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/share', { body: { role: 'view', tabId: 't2' } }),
    );
    expect(res.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'view', 'never', 't2');
  });

  it('refuses to mint a link for a tab the design does not have', async () => {
    const res = await handleDesigns(
      makeCtx('POST', '/api/designs/d1/share', { body: { role: 'view', tabId: 't9' } }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid tab' });
    expect(db.createShareLink).not.toHaveBeenCalled();
  });

  it('rescopes a link and tells the room', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    db.rescopeShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const sent: Promise<unknown>[] = [];
    const ctx = makeTestRouteContext('PUT', '/api/designs/d1/share/CODE2345', {
      owner: 'owner-1',
      body: { tabId: 't2' },
      waitUntil: (p) => sent.push(p),
    });
    const res = await handleDesigns(ctx);
    expect(res.status).toBe(200);
    expect((await res.json<{ link: { tabId: string } }>()).link.tabId).toBe('t2');
    expect(db.rescopeShareLink).toHaveBeenCalledWith({}, 'CODE2345', 't2');
    expect(sent).toHaveLength(1);
  });

  it('widens a link back to All tabs', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link({ tabId: 't2' }));
    db.rescopeShareLink.mockResolvedValue(link());
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: { tabId: null } }),
    );
    expect(res.status).toBe(200);
    expect(db.rescopeShareLink).toHaveBeenCalledWith({}, 'CODE2345', null);
  });

  it('refuses a rescope to a tab the design does not have', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: { tabId: 't9' } }),
    );
    expect(res.status).toBe(400);
    expect(db.rescopeShareLink).not.toHaveBeenCalled();
  });

  it('refuses a rescope without a tabId field', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a tabId that is not a string', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: { tabId: 7 } }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a body that is not JSON', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const ctx = makeCtx('PUT', '/api/designs/d1/share/CODE2345', {
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleDesigns({
      ...ctx,
      request: new Request(ctx.request.url, { method: 'PUT', body: '{nope' }),
    });
    expect(res.status).toBe(400);
  });

  it('404s when the link vanished between the check and the rescope', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    db.rescopeShareLink.mockResolvedValue(null);
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: { tabId: 't2' } }),
    );
    expect(res.status).toBe(404);
  });

  it("404s a rescope of another design's link", async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link({ designId: 'd2' }));
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', { body: { tabId: 't2' } }),
    );
    expect(res.status).toBe(404);
  });

  it('403s a rescope by anyone but the owner', async () => {
    const res = await handleDesigns(
      makeCtx('PUT', '/api/designs/d1/share/CODE2345', {
        owner: 'intruder',
        body: { tabId: 't2' },
      }),
    );
    expect(res.status).toBe(403);
  });
});
