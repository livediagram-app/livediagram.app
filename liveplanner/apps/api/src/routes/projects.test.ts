import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDTO } from '../types';

// Characterisation tests for handleProjects' authorisation surface.
// projects.ts is the security-critical resource: every owner-only and
// share-gated path resolves the caller, loads the project, and maps the
// outcome onto one specific status code:
//   - no resolvable owner            -> 400 (missingAuth)
//   - project missing                -> 404 (no existence leak)
//   - owner mismatch (owner-only)    -> 403 (forbidden)
//   - share gate denies (gated read/ -> 403
//     edit paths)
//   - success with no body           -> 204
// These cases pin that mapping across one representative route per
// guard shape, so the requireOwner / requireOwnedProject
// extraction can't silently swap a 403 for a 404
// (which would leak existence) or drop a missingAuth (which would let
// an unauthenticated caller through).

// vi.mock factories are hoisted above the module's top-level consts, so
// the mock fns have to be created inside vi.hoisted to exist by the time
// the factories run.
const { db, canReadProject, canEditProject, resolveProjectGrant } = vi.hoisted(() => ({
  db: {
    listProjectsByOwner: vi.fn(),
    getProject: vi.fn(),
    // The save's own one-query read (db/tab-save-project.ts); answered from getProject's mock below.
    getProjectForSave: vi.fn(),
    getShareLink: vi.fn(async () => null),
    // The thumbnail route's one-query gate + freshness read.
    getProjectThumbMeta: vi.fn(),
    upsertProjectMeta: vi.fn(),
    deleteProject: vi.fn(),
    // The Trash (docs/specs/013-workspace/trash.md): a plain delete trashes.
    trashProject: vi.fn(async () => true),
    purgeProjects: vi.fn(async () => 1),
    getTrashedProjectMeta: vi.fn(async () => null),
    getFolder: vi.fn(),
    setProjectFolder: vi.fn(),
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
    // Every share-link change withdraws the project's standing
    // `share_link_expiring` warning (docs/specs/013-workspace/timeline.md §4.5); the retraction itself is
    // covered in expiry-retraction.test.ts.
    retractTimelineWarning: vi.fn(),
    reorderTabs: vi.fn(),
    // Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md).
    copyProject: vi.fn(),
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
  canReadProject: vi.fn(),
  canEditProject: vi.fn(),
  // gateGrant (context.ts) forwards here. Defaults (beforeEach) to what the
  // two gates above answer for an unscoped caller, so a case driving
  // allow / deny through them reaches the scope-aware doors too.
  resolveProjectGrant: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('../auth/project-access', () => ({
  canReadProject,
  canEditProject,
  resolveProjectGrant,
}));

// The thumbnail route (docs/specs/006-project/project-snapshots.md) delegates rendering to ./thumbnail; stub
// it so these cases pin the ACCESS GATE, and can assert the renderer is
// never reached for a denied caller (no render, no info leak).
const { getProjectThumbnailSvg, getProjectTabImageSvg } = vi.hoisted(() => ({
  getProjectThumbnailSvg: vi.fn(),
  getProjectTabImageSvg: vi.fn(),
}));
vi.mock('../thumbnail', () => ({ getProjectThumbnailSvg, getProjectTabImageSvg }));
// The share password (docs/specs/013-workspace/share-password.md): met unless a case says otherwise.
const { sharePasswordOk } = vi.hoisted(() => ({ sharePasswordOk: vi.fn(async () => true) }));
vi.mock('../auth/share-access', () => ({ sharePasswordOk }));

import type { RouteContext } from './context';
import { handleProjects } from './projects';

// Guest-shaped context ('owner-1') with optional Clerk identity + headers.
const makeCtx = (
  method: string,
  path: string,
  opts: {
    owner?: string | null;
    clerkUserId?: string | null;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    headers: opts.headers,
    clerkUserId: opts.clerkUserId,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

// Minimal ProjectDTO good enough for the authz branches under test.
function fakeProject(ownerId: string, teamId: string | null = null): ProjectDTO {
  return { id: 'd1', ownerId, teamId, name: 'Doc', tabs: [] } as unknown as ProjectDTO;
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.setProjectFolder.mockResolvedValue(true);
  db.getProjectForSave.mockImplementation(async (...args: unknown[]) => {
    const doc = (await db.getProject(...args)) as ProjectDTO | null;
    return doc ? { ...doc, tabCount: doc.tabs?.length ?? 0 } : null;
  });
  canReadProject.mockReset();
  canEditProject.mockReset();
  resolveProjectGrant.mockReset();
  resolveProjectGrant.mockImplementation(async (...args: unknown[]) => {
    if (await canEditProject(...args)) return { role: 'edit', tabScope: null };
    if (await canReadProject(...args)) return { role: 'view', tabScope: null };
    return null;
  });
  getProjectThumbnailSvg.mockReset();
  getProjectTabImageSvg.mockReset();
});

describe('GET /projects/:id/thumbnail (docs/specs/006-project/project-snapshots.md access gate)', () => {
  it('404s an anonymous caller with no owner / share code / team — and never renders', async () => {
    db.getProjectThumbMeta.mockResolvedValue(fakeProject('someone-else'));
    canReadProject.mockResolvedValue(false);
    const res = await handleProjects(
      makeCtx('GET', '/api/projects/d1/thumbnail', { owner: null }),
    );
    expect(res.status).toBe(404);
    // The security property: a denied caller never reaches the renderer,
    // so no snapshot bytes can leak past the gate.
    expect(getProjectThumbnailSvg).not.toHaveBeenCalled();
  });

  it('404s a known owner id that fails the read gate (not theirs, no share, no team)', async () => {
    db.getProjectThumbMeta.mockResolvedValue(fakeProject('someone-else'));
    canReadProject.mockResolvedValue(false);
    const res = await handleProjects(
      makeCtx('GET', '/api/projects/d1/thumbnail', { owner: 'intruder' }),
    );
    expect(res.status).toBe(404);
    expect(getProjectThumbnailSvg).not.toHaveBeenCalled();
  });

  it('404s a missing project (no existence leak)', async () => {
    db.getProjectThumbMeta.mockResolvedValue(null);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/thumbnail'));
    expect(res.status).toBe(404);
    expect(canReadProject).not.toHaveBeenCalled();
  });

  it('serves the SVG to a caller the read gate allows (owner / share / team)', async () => {
    db.getProjectThumbMeta.mockResolvedValue(fakeProject('owner-1'));
    canReadProject.mockResolvedValue(true);
    getProjectThumbnailSvg.mockResolvedValue('<svg>ok</svg>');
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/thumbnail'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(await res.text()).toBe('<svg>ok</svg>');
  });

  it('404s when access is allowed but there is no snapshot (empty project / no R2)', async () => {
    db.getProjectThumbMeta.mockResolvedValue(fakeProject('owner-1'));
    canReadProject.mockResolvedValue(true);
    getProjectThumbnailSvg.mockResolvedValue(null);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/thumbnail'));
    expect(res.status).toBe(404);
    // Past the gate and versioned by `?v=<savedAt>`, so the browser keeps it
    // rather than re-asking on every Explorer visit.
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=86400');
  });

  it('never marks an access-denied 404 cacheable', async () => {
    db.getProjectThumbMeta.mockResolvedValue(fakeProject('someone-else'));
    canReadProject.mockResolvedValue(false);
    const res = await handleProjects(
      makeCtx('GET', '/api/projects/d1/thumbnail', { owner: 'intruder' }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });
});

describe('handleProjects owner-only paths (DELETE /projects/:id)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('404 when the project does not exist (no existence leak)', async () => {
    db.getProject.mockResolvedValue(null);
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1'));
    expect(res.status).toBe(404);
  });

  it('403 when the caller is not the owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('someone-else'));
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1'));
    expect(res.status).toBe(403);
    expect(db.deleteProject).not.toHaveBeenCalled();
  });

  it('204 and moves it to the Trash when the caller owns the project', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1'));
    expect(res.status).toBe(204);
    expect(db.trashProject).toHaveBeenCalledWith({}, 'd1', expect.any(Number));
    expect(db.deleteProject).not.toHaveBeenCalled();
  });
});

describe('a body that is not a JSON object', () => {
  it('is a 400 on the metadata PUT and the whole-tab autosave, never a 500', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    canEditProject.mockResolvedValue(true);
    for (const path of ['/api/projects/d1', '/api/projects/d1/tabs/t1']) {
      const notJson = makeTestRouteContext('PUT', path, { owner: 'owner-1', rawBody: '{nope' });
      expect((await handleProjects(notJson)).status).toBe(400);
      const nul = makeTestRouteContext('PUT', path, { owner: 'owner-1', rawBody: 'null' });
      expect((await handleProjects(nul)).status).toBe(400);
    }
  });
});

describe('handleProjects metadata PUT (PUT /projects/:id)', () => {
  it('blanks ownerId in the response for an edit-role share visitor (docs/specs/014-identity/auth-and-guest-access.md)', async () => {
    // gateEdit admits an edit-role share code, so the PUT reply reaches the
    // same audience the GET redacts for.
    db.getProject.mockResolvedValue(fakeProject('0f5ca4af-9a8a-4a60-be5e-1179e5555880'));
    canEditProject.mockResolvedValue(true);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1', {
        owner: 'visitor-1',
        body: { name: 'Doc' },
        headers: { 'X-Share-Code': 'CODE1234' },
      }),
    );
    expect(res.status).toBe(200);
    const { project: liveDoc } = (await res.json()) as { project: ProjectDTO };
    expect(liveDoc.ownerId).toBe('');
  });

  it('returns the real ownerId to the owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    canEditProject.mockResolvedValue(true);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1', { body: { name: 'Doc' } }),
    );
    const { project: liveDoc } = (await res.json()) as { project: ProjectDTO };
    expect(liveDoc.ownerId).toBe('owner-1');
  });

  it('404s an unknown id instead of create-on-first-write (ghost-row guard)', async () => {
    // A stray meta write for an id the server has never seen (e.g. an
    // Offline Mode project id leaking past the client dispatch, docs/specs/006-project/offline-mode.md)
    // must NOT mint a zero-tab project row. Projects are created via POST.
    db.getProject.mockResolvedValue(null);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1', { body: { name: 'Ghost' } }),
    );
    expect(res.status).toBe(404);
    expect(db.upsertProjectMeta).not.toHaveBeenCalled();
  });
});

describe('handleProjects list (GET /projects)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleProjects(makeCtx('GET', '/api/projects', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 with the owner-scoped list', async () => {
    db.listProjectsByOwner.mockResolvedValue([{ id: 'd1' }]);
    const res = await handleProjects(makeCtx('GET', '/api/projects'));
    expect(res.status).toBe(200);
    expect(db.listProjectsByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });
});

describe('GET /projects/:id owner-id redaction (docs/specs/014-identity/auth-and-guest-access.md)', () => {
  // The DTO's ownerId is a credential: for a guest owner it is the
  // X-Owner-Id bearer value, and /api/migrate moves that owner's whole
  // workspace to whoever presents it. The share-code resolver has always
  // blanked it; this door reaches the same DTO for the same audience (the
  // read gate admits any valid share code, view or edit) and used to hand
  // it over intact.
  const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

  it('blanks ownerId for a share-code visitor', async () => {
    db.getProject.mockResolvedValue(fakeProject(GUEST));
    canReadProject.mockResolvedValue(true);
    const res = await handleProjects(
      makeCtx('GET', '/api/projects/d1', {
        owner: 'visitor-1',
        headers: { 'X-Share-Code': 'CODE1234' },
      }),
    );
    expect(res.status).toBe(200);
    const { project: liveDoc } = (await res.json()) as { project: ProjectDTO };
    expect(liveDoc.ownerId).toBe('');
    // The visitor still gets the project itself — redaction, not refusal.
    expect(liveDoc.id).toBe('d1');
    expect(liveDoc.name).toBe('Doc');
  });

  it('returns the real ownerId to the owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    canReadProject.mockResolvedValue(true);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1'));
    const { project: liveDoc } = (await res.json()) as { project: ProjectDTO };
    expect(liveDoc.ownerId).toBe('owner-1');
  });

  it('blanks it for a joined team member, who is not the owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('user_owner', 'team-1'));
    canReadProject.mockResolvedValue(true);
    const res = await handleProjects(
      makeCtx('GET', '/api/projects/d1', { owner: 'user_member', clerkUserId: 'user_member' }),
    );
    const { project: liveDoc } = (await res.json()) as { project: ProjectDTO };
    // No regression for them: a teammate already computed isOwner=false from
    // the real id, so they lose nothing they were using.
    expect(liveDoc.ownerId).toBe('');
  });

  it('still 404s a denied reader (redaction is not the gate)', async () => {
    db.getProject.mockResolvedValue(fakeProject(GUEST));
    canReadProject.mockResolvedValue(false);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1', { owner: 'stranger' }));
    expect(res.status).toBe(404);
  });
});

describe('handleProjects folder assignment (PUT /projects/:id/folder)', () => {
  it('403 on owner mismatch', async () => {
    db.getProject.mockResolvedValue(fakeProject('someone-else'));
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(403);
  });

  it('204 when the owner clears the folder', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(204);
    // 5th arg (newOwnerId) is undefined: a personal move keeps the owner.
    expect(db.setProjectFolder).toHaveBeenCalledWith({}, 'd1', null, null, undefined);
  });

  // docs/specs/013-workspace/team-shared-projects.md: a team project belongs to every joined member, so any of
  // them may move it out into their OWN personal library — and doing so
  // transfers ownership to the mover (folders are owner-scoped).
  it('transfers ownership when a joined member moves a team project out to their folder', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-2', 'team-1'));
    db.getMembership.mockResolvedValue({ status: 'joined', role: 'member' });
    db.getFolder.mockResolvedValue({ id: 'f1', teamId: null, ownerId: 'member-1' });
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/folder', {
        owner: 'member-1',
        clerkUserId: 'member-1',
        body: { folderId: 'f1', teamId: null },
      }),
    );
    expect(res.status).toBe(204);
    expect(db.setProjectFolder).toHaveBeenCalledWith({}, 'd1', 'f1', null, 'member-1');
  });

  it('403 when a non-member tries to move a team project out', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-2', 'team-1'));
    db.getMembership.mockResolvedValue(undefined);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/folder', {
        owner: 'stranger',
        clerkUserId: 'stranger',
        body: { folderId: null, teamId: null },
      }),
    );
    expect(res.status).toBe(403);
    expect(db.setProjectFolder).not.toHaveBeenCalled();
  });
});

describe('handleProjects gated tab read (GET /projects/:id/tabs/:tabId)', () => {
  it('404 when the project is missing', async () => {
    db.getProject.mockResolvedValue(null);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/tabs/t1'));
    expect(res.status).toBe(404);
  });

  it('403 when the read gate denies the visitor', async () => {
    db.getProject.mockResolvedValue(fakeProject('someone-else'));
    canReadProject.mockResolvedValue(false);
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/tabs/t1'));
    expect(res.status).toBe(403);
  });

  it('200 when the read gate allows and the tab exists', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    canReadProject.mockResolvedValue(true);
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', elements: [] });
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/tabs/t1'));
    expect(res.status).toBe(200);
  });
});

describe('handleProjects share-link expiry (docs/specs/013-workspace/share-link-expiry.md)', () => {
  const link = {
    code: 'CODE2345',
    projectId: 'd1',
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

  it('POST /projects/:id/share forwards a valid expiry choice', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    db.createShareLink.mockResolvedValue(link);
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/share', { body: { role: 'edit', expiry: 'week' } }),
    );
    expect(res.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'edit', 'week', null);
  });

  it('POST /projects/:id/share defaults unknown / missing expiry to never', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    db.createShareLink.mockResolvedValue({ ...link, expiry: 'never', expiresAt: null });
    await handleProjects(
      makeCtx('POST', '/api/projects/d1/share', { body: { role: 'view', expiry: 'fortnight' } }),
    );
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'view', 'never', null);
  });

  it('extend re-arms an expiring link for the owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue(link);
    db.extendShareLink.mockResolvedValue({ ...link, expiresAt: 99 });
    const res = await handleProjects(makeCtx('POST', '/api/projects/d1/share/CODE2345/extend'));
    expect(res.status).toBe(200);
    expect(db.extendShareLink).toHaveBeenCalledWith({}, 'CODE2345');
  });

  it('extend 404s when the code belongs to a different project', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, projectId: 'other' });
    const res = await handleProjects(makeCtx('POST', '/api/projects/d1/share/CODE2345/extend'));
    expect(res.status).toBe(404);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });

  it('extend 400s on a never-expiring link (nothing to extend)', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, expiry: 'never' });
    db.extendShareLink.mockResolvedValue(null);
    const res = await handleProjects(makeCtx('POST', '/api/projects/d1/share/CODE2345/extend'));
    expect(res.status).toBe(400);
  });

  it('extend 403s for a non-owner', async () => {
    db.getProject.mockResolvedValue(fakeProject('someone-else'));
    const res = await handleProjects(makeCtx('POST', '/api/projects/d1/share/CODE2345/extend'));
    expect(res.status).toBe(403);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });
});

describe('handleProjects tab-content data-loss backstop (PUT /projects/:id/tabs/:tabId)', () => {
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
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    canEditProject.mockResolvedValue(true);
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
    const res = await handleProjects(makeCtx('PUT', '/api/projects/d1/tabs/t1', { body: huge }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    expect(db.upsertTabAtRev).not.toHaveBeenCalled();
  });

  it('413s using the declared Content-Length without re-stringifying', async () => {
    // The fast path the cap is written around: one PUT per ~600ms per editor,
    // so a trusted header skips a 4 MB stringify + encode. A small body with a
    // large declared length still trips it.
    db.getTab.mockResolvedValue(null);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', {
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
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', { body: tabBody([{ id: 'e1' }]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('409s and does NOT write when an empty body would blank a tab that has content', async () => {
    // The wipe shape: a never-loaded placeholder PUTs `{ elements: [] }`
    // over a real row, with no X-Allow-Empty header.
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', { body: tabBody([]) }),
    );
    expect(res.status).toBe(409);
    expect(db.upsertTabAtRev).not.toHaveBeenCalled();
  });

  it('allows the empty write when the client marks it intentional (X-Allow-Empty: 1)', async () => {
    // A real reset-canvas / delete-all on the loaded tab sends the header.
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', {
        body: tabBody([]),
        headers: { 'X-Allow-Empty': '1' },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('allows an empty write over an already-empty (or new) row — nothing to lose', async () => {
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [] });
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', { body: tabBody([]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });

  it('allows a non-empty write over a tab with content (the normal save path)', async () => {
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', orderIndex: 0, elements: [{ id: 'e' }] });
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/tabs/t1', { body: tabBody([{ id: 'e2' }]) }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertTabAtRev).toHaveBeenCalled();
  });
});

describe('POST /projects carrying an Offline Mode sync (docs/specs/006-project/offline-mode.md)', () => {
  // The offline record is deleted once the create succeeds, so the folder
  // has to arrive with it.
  const create = (body: Record<string, unknown>) =>
    handleProjects(
      makeCtx('POST', '/api/projects', { body: { id: 'd1', name: 'Doc', ...body } }),
    );
  const stored = () => db.upsertProjectMeta.mock.calls[0]![1] as Record<string, unknown>;

  it("keeps a folder that is the caller's own personal folder", async () => {
    db.getProject.mockResolvedValue(null);
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1', teamId: null });
    await create({ folderId: 'f1' });
    expect(stored().folderId).toBe('f1');
  });

  it("refuses a folder that isn't theirs by name, writing nothing", async () => {
    // docs/specs/013-workspace/folders.md "Placement on create": never filed elsewhere instead.
    // The sync itself refiles at the root on this refusal (lib/offline/offline-convert.ts).
    db.getProject.mockResolvedValue(null);
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'someone-else', teamId: null });
    const res = await create({ folderId: 'f1' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'folder_not_found' });
    expect(db.upsertProjectMeta).not.toHaveBeenCalled();
  });
});

// docs/specs/015-api/api.md "Project dates": an imported board keeps its own dates.
describe('POST /projects carrying its own dates', () => {
  const create = (body: Record<string, unknown>) =>
    handleProjects(
      makeCtx('POST', '/api/projects', { body: { id: 'd1', name: 'Doc', ...body } }),
    );
  const stored = () => db.upsertProjectMeta.mock.calls[0]![1] as Record<string, unknown>;
  const createdAt = Date.UTC(2020, 7, 14);
  const savedAt = Date.UTC(2021, 1, 3);

  it('stores the board’s created and modified dates', async () => {
    db.getProject.mockResolvedValue(null);
    const res = await create({ createdAt, savedAt });
    expect(res.status).toBe(201);
    expect(stored()).toMatchObject({ createdAt, savedAt });
  });

  it('refuses invalid dates whole, writing nothing', async () => {
    db.getProject.mockResolvedValue(null);
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
    expect(db.upsertProjectMeta).not.toHaveBeenCalled();
  });

  it('modifies a re-committed project now, whatever dates it sends', async () => {
    db.getProject.mockResolvedValue(fakeProject('owner-1'));
    const before = Date.now();
    await create({ createdAt, savedAt });
    expect(stored().savedAt as number).toBeGreaterThanOrEqual(before);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md. A visitor on a link scoped to tab t2: every door either
// narrows to t2 or refuses.
describe('a tab-scoped visitor', () => {
  const scopedProject = () =>
    ({
      ...fakeProject('owner-1'),
      tabs: [
        { id: 't1', projectId: 'd1', name: 'Pricing', orderIndex: 0, updatedAt: 1 },
        { id: 't2', projectId: 'd1', name: 'Roadmap', orderIndex: 1, updatedAt: 1 },
      ],
    }) as unknown as ProjectDTO;
  const visitor = { owner: 'visitor-1', headers: { 'X-Share-Code': 'SCOPED23' } };

  beforeEach(() => {
    db.getProject.mockResolvedValue(scopedProject());
    db.getProjectThumbMeta.mockResolvedValue(scopedProject());
    resolveProjectGrant.mockResolvedValue({ role: 'edit', tabScope: 't2' });
  });

  it('gets the project with every other tab locked', async () => {
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1', visitor));
    const body = (await res.json()) as { project: ProjectDTO };
    expect(body.project.tabs.map((t) => t.name)).toEqual(['', 'Roadmap']);
  });

  it("gets its tab's image as the thumbnail, never the first tab's", async () => {
    getProjectTabImageSvg.mockResolvedValue('<svg>t2</svg>');
    const res = await handleProjects(makeCtx('GET', '/api/projects/d1/thumbnail', visitor));
    expect(await res.text()).toBe('<svg>t2</svg>');
    expect(getProjectTabImageSvg).toHaveBeenCalledWith(expect.anything(), expect.anything(), 't2');
    expect(getProjectThumbnailSvg).not.toHaveBeenCalled();
  });

  it('names the tab it touches, so the gate can confine it', async () => {
    // Reading: the grant's tab scope opens its own tab and no other.
    db.getTab.mockResolvedValue({ id: 't2', name: 'Roadmap', elements: [] });
    const own = await handleProjects(makeCtx('GET', '/api/projects/d1/tabs/t2', visitor));
    expect(own.status).toBe(200);
    const other = await handleProjects(makeCtx('GET', '/api/projects/d1/tabs/t1', visitor));
    expect(other.status).toBe(404);
    canEditProject.mockResolvedValue(true);
    await handleProjects(makeCtx('PUT', '/api/projects/d1/tabs/t2', { ...visitor, body: {} }));
    expect(canEditProject.mock.calls.at(-1)?.at(-1)).toBe('t2');
  });

  it('cannot delete the tab its link is scoped to', async () => {
    canEditProject.mockResolvedValue(true);
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1/tabs/t2', visitor));
    expect(res.status).toBe(403);
    expect(db.deleteTabRow).not.toHaveBeenCalled();
  });

  it('copies its tab only', async () => {
    db.copyProject.mockResolvedValue({ id: 'd2' });
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/copy', { ...visitor, body: {} }),
    );
    expect(res.status).toBe(201);
    expect(db.copyProject.mock.calls[0]?.at(5)).toBe('t2');
  });

  it('copies with a JSON null body as with none, never a 500', async () => {
    db.copyProject.mockResolvedValue({ id: 'd2' });
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/copy', { ...visitor, body: null }),
    );
    expect(res.status).toBe(201);
  });

  it('copies its tab only through its Shared-with-you row too', async () => {
    resolveProjectGrant.mockResolvedValue(null);
    db.listSharedWith.mockResolvedValue([{ id: 'd1', tabId: 't2' }]);
    db.copyProject.mockResolvedValue({ id: 'd2' });
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/copy', { owner: 'visitor-1', body: {} }),
    );
    expect(res.status).toBe(201);
    expect(db.copyProject.mock.calls[0]?.at(5)).toBe('t2');
    // A visitor's copy carries no one else's comment author ids.
    expect(db.copyProject.mock.calls[0]?.at(6)).toBe('visitor-1');
  });

  it('refuses a Shared-with-you copy without the share password', async () => {
    resolveProjectGrant.mockResolvedValue(null);
    db.listSharedWith.mockResolvedValue([{ id: 'd1', tabId: null }]);
    sharePasswordOk.mockResolvedValueOnce(false);
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/copy', { owner: 'visitor-1', body: {} }),
    );
    expect(res.status).toBe(403);
    expect(db.copyProject).not.toHaveBeenCalled();
  });
});

describe('deleting a tab (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
  const withTabs = (...ids: string[]) =>
    ({ ...fakeProject('owner-1'), tabs: ids.map((id) => ({ id })) }) as unknown as ProjectDTO;

  it('refuses a tab the project does not have, and the last tab for a token', async () => {
    canEditProject.mockResolvedValue(true);
    db.getProject.mockResolvedValue(withTabs('t1', 't2'));
    expect((await handleProjects(makeCtx('DELETE', '/api/projects/d1/tabs/nope'))).status).toBe(
      404,
    );
    db.getProject.mockResolvedValue(withTabs('t1'));
    const agent = makeTestRouteContext('DELETE', '/api/projects/d1/tabs/t1', {
      owner: 'owner-1',
      token: { id: 'tok' },
    });
    const res = await handleProjects(agent);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_tab' });
    expect(db.deleteTabRow).not.toHaveBeenCalled();
    // The editor's own delete races its save of the new tab: let through.
    expect((await handleProjects(makeCtx('DELETE', '/api/projects/d1/tabs/t1'))).status).toBe(
      204,
    );
  });

  it('takes the links scoped to it along', async () => {
    db.getProject.mockResolvedValue(withTabs('t1', 't2'));
    canEditProject.mockResolvedValue(true);
    db.deleteShareLinksForTab.mockResolvedValue(['AAAA2222']);
    const res = await handleProjects(makeCtx('DELETE', '/api/projects/d1/tabs/t2'));
    expect(res.status).toBe(204);
    expect(db.deleteTabRow).toHaveBeenCalledWith(expect.anything(), 'd1', 't2');
    expect(db.deleteShareLinksForTab).toHaveBeenCalledWith(expect.anything(), 'd1', 't2');
  });
});

describe('share-link scope (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
  const twoTabs = () =>
    ({
      ...fakeProject('owner-1'),
      tabs: [
        { id: 't1', projectId: 'd1', name: 'A', orderIndex: 0, updatedAt: 1 },
        { id: 't2', projectId: 'd1', name: 'B', orderIndex: 1, updatedAt: 1 },
      ],
    }) as unknown as ProjectDTO;
  const link = (over: Record<string, unknown> = {}) => ({
    code: 'CODE2345',
    projectId: 'd1',
    role: 'view',
    createdAt: 1,
    expiry: 'never',
    expiresAt: null,
    tabId: null,
    ...over,
  });

  beforeEach(() => {
    db.getProject.mockResolvedValue(twoTabs());
    db.generateShareCode.mockReturnValue('CODE2345');
  });

  it('mints a link scoped to one of the project tabs', async () => {
    db.createShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/share', { body: { role: 'view', tabId: 't2' } }),
    );
    expect(res.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'view', 'never', 't2');
  });

  it('refuses to mint a link for a tab the project does not have', async () => {
    const res = await handleProjects(
      makeCtx('POST', '/api/projects/d1/share', { body: { role: 'view', tabId: 't9' } }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid tab' });
    expect(db.createShareLink).not.toHaveBeenCalled();
  });

  it('rescopes a link and tells the room', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    db.rescopeShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const sent: Promise<unknown>[] = [];
    const ctx = makeTestRouteContext('PUT', '/api/projects/d1/share/CODE2345', {
      owner: 'owner-1',
      body: { tabId: 't2' },
      waitUntil: (p) => sent.push(p),
    });
    const res = await handleProjects(ctx);
    expect(res.status).toBe(200);
    expect((await res.json<{ link: { tabId: string } }>()).link.tabId).toBe('t2');
    expect(db.rescopeShareLink).toHaveBeenCalledWith({}, 'CODE2345', 't2');
    expect(sent).toHaveLength(1);
  });

  it('widens a link back to All tabs', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link({ tabId: 't2' }));
    db.rescopeShareLink.mockResolvedValue(link());
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: { tabId: null } }),
    );
    expect(res.status).toBe(200);
    expect(db.rescopeShareLink).toHaveBeenCalledWith({}, 'CODE2345', null);
  });

  it('refuses a rescope to a tab the project does not have', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: { tabId: 't9' } }),
    );
    expect(res.status).toBe(400);
    expect(db.rescopeShareLink).not.toHaveBeenCalled();
  });

  it('refuses a rescope without a tabId field', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a tabId that is not a string', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: { tabId: 7 } }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a body that is not JSON', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    const ctx = makeCtx('PUT', '/api/projects/d1/share/CODE2345', {
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleProjects({
      ...ctx,
      request: new Request(ctx.request.url, { method: 'PUT', body: '{nope' }),
    });
    expect(res.status).toBe(400);
  });

  it('404s when the link vanished between the check and the rescope', async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link());
    db.rescopeShareLink.mockResolvedValue(null);
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: { tabId: 't2' } }),
    );
    expect(res.status).toBe(404);
  });

  it("404s a rescope of another project's link", async () => {
    db.getShareLinkIncludingExpired.mockResolvedValue(link({ projectId: 'd2' }));
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', { body: { tabId: 't2' } }),
    );
    expect(res.status).toBe(404);
  });

  it('403s a rescope by anyone but the owner', async () => {
    const res = await handleProjects(
      makeCtx('PUT', '/api/projects/d1/share/CODE2345', {
        owner: 'intruder',
        body: { tabId: 't2' },
      }),
    );
    expect(res.status).toBe(403);
  });
});
