import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@livediagram/api-schema';
import type { Env } from '../types';

// `canEditDiagram` and `canReadDiagram` gate every request through
// the api worker's diagram routes. A regression in either silently
// translates to "the wrong visitor sees / edits this diagram" with
// no other surface signal: the route still 200s, the body just
// goes to the wrong audience. The cases below cover every branch
// in both helpers, with `getShareLink` stubbed so we can drive the
// share-link state without a D1 binding.

// vi.mock is hoisted by vitest so the factory runs before the
// helpers' module evaluates its `import { getShareLink } from
// '../db'`. The stub returns the spy we control per test case.
const getShareLinkMock = vi.fn<(env: Env, code: string) => Promise<ShareLink | null>>();
// Share password (spec/24). Defaults to "no password" so every legacy
// case below is unaffected; the password-specific cases set it.
const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
vi.mock('../db', () => ({
  getShareLink: (env: Env, code: string) => getShareLinkMock(env, code),
  getDiagramSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
}));

// Import AFTER the mock declaration so the helpers pick up the
// stubbed `getShareLink`. The helpers themselves don't care about
// the Env shape past the type, so we hand the assertions a stub.
import { canEditDiagram, canReadDiagram } from './diagram-access';

const FAKE_ENV = {} as Env;

beforeEach(() => {
  getShareLinkMock.mockReset();
  getSharePasswordMock.mockReset();
  // Default: the diagram has no share password, so the password gate
  // is a no-op and the link/role checks behave exactly as before.
  getSharePasswordMock.mockResolvedValue(null);
});

afterEach(() => {
  // Tests must not leak the share-link stub between cases (a stale
  // mockResolvedValue from a prior test would make a "no share
  // code" case accidentally pass via the lookup short-circuit).
  expect.hasAssertions();
});

describe('canEditDiagram', () => {
  it('returns true when owner matches the diagram ownerId (no share code consulted)', async () => {
    // The owner short-circuit doesn't call getShareLink at all.
    // Asserting the mock wasn't invoked pins that the owner path
    // stays cheap (no D1 round-trip per editor write).
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when there is no owner and no share code', async () => {
    // A guest who hasn't sent X-Owner-Id and didn't follow a
    // share link has no claim on the diagram at all. Catches a
    // regression that defaulted to "true" if both inputs were
    // null/empty.
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, null, 'owner-a');
    expect(allowed).toBe(false);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when the share code does not resolve (revoked / nonexistent)', async () => {
    // A code that was once valid but has been revoked returns
    // null from getShareLink. The viewer / editor must be denied
    // even if the URL still carries the code.
    getShareLinkMock.mockResolvedValue(null);
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false when the share code maps to a DIFFERENT diagram (link mismatch)', async () => {
    // The link.diagramId guard is the second crucial check: a
    // legit edit-role code for diag-2 must NOT grant access to
    // diag-1. Catches a regression that dropped the diagram-id
    // verification.
    getShareLinkMock.mockResolvedValue({
      code: 'ABC23456',
      role: 'edit',
      diagramId: 'diag-2',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false for a VIEW-role code (read access is not write access)', async () => {
    // The fix in commit 069b785 opened reads to view-role
    // visitors via canReadDiagram. Writes must stay edit-only:
    // a view code carrying the same diagramId still returns
    // false here.
    getShareLinkMock.mockResolvedValue({
      code: 'VIEW2345',
      role: 'view',
      diagramId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns true for an EDIT-role code matching the diagram', async () => {
    getShareLinkMock.mockResolvedValue({
      code: 'EDIT2345',
      role: 'edit',
      diagramId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a');
    expect(allowed).toBe(true);
  });

  it('returns true when the resolved owner DOES match even if a share code is also present', async () => {
    // A signed-in owner clicking their own share link still
    // identifies as owner via the Bearer / X-Owner-Id header.
    // The owner short-circuit fires first; the link isn't even
    // consulted. Pins that owner identity takes precedence.
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', 'owner-a', 'ANY2345A', 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });
});

describe('canReadDiagram', () => {
  it('returns true when owner matches (no share code consulted)', async () => {
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when there is no owner and no share code', async () => {
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, null, 'owner-a');
    expect(allowed).toBe(false);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when the share code is revoked / nonexistent', async () => {
    getShareLinkMock.mockResolvedValue(null);
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false when the share code maps to a DIFFERENT diagram', async () => {
    // Same diagram-id guard as canEditDiagram. A read on diag-1
    // with a code for diag-2 must still 403.
    getShareLinkMock.mockResolvedValue({
      code: 'ABC23456',
      role: 'view',
      diagramId: 'diag-2',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns true for a VIEW-role code matching the diagram (the load-bearing case)', async () => {
    // The whole reason this helper exists. The fix in commit
    // 069b785 found that GET /api/diagrams/:id/tabs/:tabId was
    // gated on canEditDiagram, so view-only visitors got a 403
    // and saw every tab blank. canReadDiagram opens reads to
    // view-role visitors; the test pins that view IS allowed.
    getShareLinkMock.mockResolvedValue({
      code: 'VIEW2345',
      role: 'view',
      diagramId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a');
    expect(allowed).toBe(true);
  });

  it('returns true for an EDIT-role code matching the diagram (edit is read-and-write)', async () => {
    // Edit role is a superset of view: anyone with an edit code
    // also has read access. The role check in canEditDiagram is
    // the only place where role: 'view' is treated differently.
    getShareLinkMock.mockResolvedValue({
      code: 'EDIT2345',
      role: 'edit',
      diagramId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
    });
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a');
    expect(allowed).toBe(true);
  });
});

describe('share password gate (spec/24)', () => {
  // A valid edit-role code for diag-1 in every case below; the password
  // is what flips access.
  const editLink: ShareLink = {
    code: 'EDIT2345',
    role: 'edit',
    diagramId: 'diag-1',
    createdAt: 0,
    expiry: 'never',
    expiresAt: null,
  };

  it('denies a share-code edit when the password is required but absent', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a', null);
    expect(allowed).toBe(false);
  });

  it('denies a share-code edit when the password is wrong', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a', 'nope');
    expect(allowed).toBe(false);
  });

  it('allows a share-code edit when the password matches', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDiagram(
      FAKE_ENV,
      'diag-1',
      null,
      'EDIT2345',
      'owner-a',
      'hunter2',
    );
    expect(allowed).toBe(true);
  });

  it('denies a view read on a protected diagram without the password', async () => {
    getShareLinkMock.mockResolvedValue({ ...editLink, code: 'VIEW2345', role: 'view' });
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canReadDiagram(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a', null);
    expect(allowed).toBe(false);
  });

  it('allows a view read on a protected diagram with the matching password', async () => {
    getShareLinkMock.mockResolvedValue({ ...editLink, code: 'VIEW2345', role: 'view' });
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canReadDiagram(
      FAKE_ENV,
      'diag-1',
      null,
      'VIEW2345',
      'owner-a',
      'hunter2',
    );
    expect(allowed).toBe(true);
  });

  it('never consults the password for the owner (bypass stays cheap)', async () => {
    // Owner short-circuit must fire before any password lookup, so an
    // owner is never locked out of their own diagram.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDiagram(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a', null);
    expect(allowed).toBe(true);
    expect(getSharePasswordMock).not.toHaveBeenCalled();
  });
});
