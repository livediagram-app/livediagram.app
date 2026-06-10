import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDTO, Env } from '../types';

// Characterisation tests for handleDiagrams' authorisation surface.
// diagrams.ts is the security-critical resource: every owner-only and
// share-gated path resolves the caller, loads the diagram, and maps the
// outcome onto one specific status code:
//   - no resolvable owner            -> 400 (missingAuth)
//   - diagram missing                -> 404 (no existence leak)
//   - owner mismatch (owner-only)    -> 403 (forbidden)
//   - share gate denies (gated read/ -> 403
//     edit paths)
//   - success with no body           -> 204
// These cases pin that mapping across one representative route per
// guard shape, so the requireOwner / requireOwnedDiagram /
// requireDiagramAccess extraction can't silently swap a 403 for a 404
// (which would leak existence) or drop a missingAuth (which would let
// an unauthenticated caller through).

// vi.mock factories are hoisted above the module's top-level consts, so
// the mock fns have to be created inside vi.hoisted to exist by the time
// the factories run.
const { db, canReadDiagram, canEditDiagram } = vi.hoisted(() => ({
  db: {
    listDiagramsByOwner: vi.fn(),
    getDiagram: vi.fn(),
    deleteDiagram: vi.fn(),
    getFolder: vi.fn(),
    setDiagramFolder: vi.fn(),
    getTab: vi.fn(),
    listChangeLog: vi.fn(),
    insertChangeLogEntry: vi.fn(),
    // Share-link create / extend surface (spec/34).
    createShareLink: vi.fn(),
    generateShareCode: vi.fn(() => 'CODE2345'),
    getShareLinkIncludingExpired: vi.fn(),
    extendShareLink: vi.fn(),
  },
  // gateRead / gateEdit (context.ts) forward to these; mocking the auth
  // module lets each case drive "allowed" / "denied" directly.
  canReadDiagram: vi.fn(),
  canEditDiagram: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('../auth/diagram-access', () => ({ canReadDiagram, canEditDiagram }));

import type { RouteContext } from './context';
import { handleDiagrams } from './diagrams';

function makeCtx(
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return {
    request,
    env: {} as Env,
    url,
    segments,
    clerkUserId: null,
    clerkEmail: null,
    resolveOwner: () => owner,
  };
}

// Minimal DiagramDTO good enough for the authz branches under test.
function fakeDiagram(ownerId: string, teamId: string | null = null): DiagramDTO {
  return { id: 'd1', ownerId, teamId, name: 'Doc', tabs: [] } as unknown as DiagramDTO;
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  canReadDiagram.mockReset();
  canEditDiagram.mockReset();
});

describe('handleDiagrams owner-only paths (DELETE /diagrams/:id)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleDiagrams(makeCtx('DELETE', '/api/diagrams/d1', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('404 when the diagram does not exist (no existence leak)', async () => {
    db.getDiagram.mockResolvedValue(null);
    const res = await handleDiagrams(makeCtx('DELETE', '/api/diagrams/d1'));
    expect(res.status).toBe(404);
  });

  it('403 when the caller is not the owner', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('someone-else'));
    const res = await handleDiagrams(makeCtx('DELETE', '/api/diagrams/d1'));
    expect(res.status).toBe(403);
    expect(db.deleteDiagram).not.toHaveBeenCalled();
  });

  it('204 and deletes when the caller owns the diagram', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    const res = await handleDiagrams(makeCtx('DELETE', '/api/diagrams/d1'));
    expect(res.status).toBe(204);
    expect(db.deleteDiagram).toHaveBeenCalledWith({}, 'd1');
  });
});

describe('handleDiagrams list (GET /diagrams)', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 with the owner-scoped list', async () => {
    db.listDiagramsByOwner.mockResolvedValue([{ id: 'd1' }]);
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams'));
    expect(res.status).toBe(200);
    expect(db.listDiagramsByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });
});

describe('handleDiagrams folder assignment (PUT /diagrams/:id/folder)', () => {
  it('403 on owner mismatch', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('someone-else'));
    const res = await handleDiagrams(
      makeCtx('PUT', '/api/diagrams/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(403);
  });

  it('204 when the owner clears the folder', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    const res = await handleDiagrams(
      makeCtx('PUT', '/api/diagrams/d1/folder', { body: { folderId: null } }),
    );
    expect(res.status).toBe(204);
    expect(db.setDiagramFolder).toHaveBeenCalledWith({}, 'd1', null, null);
  });
});

describe('handleDiagrams gated tab read (GET /diagrams/:id/tabs/:tabId)', () => {
  it('404 when the diagram is missing', async () => {
    db.getDiagram.mockResolvedValue(null);
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams/d1/tabs/t1'));
    expect(res.status).toBe(404);
  });

  it('403 when the read gate denies the visitor', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('someone-else'));
    canReadDiagram.mockResolvedValue(false);
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams/d1/tabs/t1'));
    expect(res.status).toBe(403);
  });

  it('200 when the read gate allows and the tab exists', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    canReadDiagram.mockResolvedValue(true);
    db.getTab.mockResolvedValue({ id: 't1', name: 'Tab', elements: [] });
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams/d1/tabs/t1'));
    expect(res.status).toBe(200);
  });
});

describe('handleDiagrams share-link expiry (spec/34)', () => {
  const link = {
    code: 'CODE2345',
    diagramId: 'd1',
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

  it('POST /diagrams/:id/share forwards a valid expiry choice', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    db.createShareLink.mockResolvedValue(link);
    const res = await handleDiagrams(
      makeCtx('POST', '/api/diagrams/d1/share', { body: { role: 'edit', expiry: 'week' } }),
    );
    expect(res.status).toBe(201);
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'edit', 'week');
  });

  it('POST /diagrams/:id/share defaults unknown / missing expiry to never', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    db.createShareLink.mockResolvedValue({ ...link, expiry: 'never', expiresAt: null });
    await handleDiagrams(
      makeCtx('POST', '/api/diagrams/d1/share', { body: { role: 'view', expiry: 'fortnight' } }),
    );
    expect(db.createShareLink).toHaveBeenCalledWith({}, 'd1', 'CODE2345', 'view', 'never');
  });

  it('extend re-arms an expiring link for the owner', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue(link);
    db.extendShareLink.mockResolvedValue({ ...link, expiresAt: 99 });
    const res = await handleDiagrams(makeCtx('POST', '/api/diagrams/d1/share/CODE2345/extend'));
    expect(res.status).toBe(200);
    expect(db.extendShareLink).toHaveBeenCalledWith({}, 'CODE2345');
  });

  it('extend 404s when the code belongs to a different diagram', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, diagramId: 'other' });
    const res = await handleDiagrams(makeCtx('POST', '/api/diagrams/d1/share/CODE2345/extend'));
    expect(res.status).toBe(404);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });

  it('extend 400s on a never-expiring link (nothing to extend)', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    db.getShareLinkIncludingExpired.mockResolvedValue({ ...link, expiry: 'never' });
    db.extendShareLink.mockResolvedValue(null);
    const res = await handleDiagrams(makeCtx('POST', '/api/diagrams/d1/share/CODE2345/extend'));
    expect(res.status).toBe(400);
  });

  it('extend 403s for a non-owner', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('someone-else'));
    const res = await handleDiagrams(makeCtx('POST', '/api/diagrams/d1/share/CODE2345/extend'));
    expect(res.status).toBe(403);
    expect(db.extendShareLink).not.toHaveBeenCalled();
  });
});

describe('handleDiagrams gated change-log (GET/POST /diagrams/:id/log)', () => {
  it('403 when the edit gate denies', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('someone-else'));
    canEditDiagram.mockResolvedValue(false);
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams/d1/log'));
    expect(res.status).toBe(403);
  });

  it('200 listing when the edit gate allows', async () => {
    db.getDiagram.mockResolvedValue(fakeDiagram('owner-1'));
    canEditDiagram.mockResolvedValue(true);
    db.listChangeLog.mockResolvedValue([]);
    const res = await handleDiagrams(makeCtx('GET', '/api/diagrams/d1/log'));
    expect(res.status).toBe(200);
  });
});
