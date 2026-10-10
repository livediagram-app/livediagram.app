import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@livediagram/api-schema';
import type { Env } from '../types';

// `canEditDocument` and `canReadDocument` gate every request through
// the api worker's document routes. A regression in either silently
// translates to "the wrong visitor sees / edits this document" with
// no other surface signal: the route still 200s, the body just
// goes to the wrong audience. The cases below cover every branch
// in both helpers, with `getShareLink` stubbed so we can drive the
// share-link state without a D1 binding.

// vi.mock is hoisted by vitest so the factory runs before the
// helpers' module evaluates its `import { getShareLink } from
// '../db'`. The stub returns the spy we control per test case.
const getShareLinkMock = vi.fn<(env: Env, code: string) => Promise<ShareLink | null>>();
// Share password (docs/specs/013-workspace/share-password.md). Defaults to "no password" so every legacy
// case below is unaffected; the password-specific cases set it.
const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
// Team membership (docs/specs/013-workspace/team-shared-documents.md). Defaults to "not a member" so every
// pre-team case is unaffected; the team cases set it.
const getMembershipMock =
  vi.fn<(env: Env, teamId: string, userId: string) => Promise<{ status: string } | null>>();
vi.mock('../db', () => ({
  getShareLink: (env: Env, code: string) => getShareLinkMock(env, code),
  getDocumentSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
  // A legacy plain-text password is rewritten as a hash on its first correct entry.
  upgradeDocumentSharePassword: async () => {},
  getMembership: (env: Env, teamId: string, userId: string) =>
    getMembershipMock(env, teamId, userId),
  communityLinkAccess: (env: Env, code: string) => communityLinkAccessMock(env, code),
}));
// Whether a Community post's link is public, for the community-link cases (docs/specs/025-community/community.md).
const communityLinkAccessMock = vi.fn<
  (env: Env, code: string) => Promise<'public' | 'closed' | null>
>(async () => 'public');

// Import AFTER the mock declaration so the helpers pick up the
// stubbed `getShareLink`. The helpers themselves don't care about
// the Env shape past the type, so we hand the assertions a stub.
import {
  canEditDocument,
  canParticipateDocument,
  canReadDocument,
  resolveDocumentGrant,
} from './document-access';

// The password a request carries, with the caller network its check spends.
const pw = (value: string) => ({ value, rateKey: 'net-1' });
const FAKE_ENV = {} as Env;

beforeEach(() => {
  getShareLinkMock.mockReset();
  getSharePasswordMock.mockReset();
  getMembershipMock.mockReset();
  getMembershipMock.mockResolvedValue(null);
  // Default: the document has no share password, so the password gate
  // is a no-op and the link/role checks behave exactly as before.
  getSharePasswordMock.mockResolvedValue(null);
});

afterEach(() => {
  // Tests must not leak the share-link stub between cases (a stale
  // mockResolvedValue from a prior test would make a "no share
  // code" case accidentally pass via the lookup short-circuit).
  expect.hasAssertions();
});

describe('canEditDocument', () => {
  it('returns true when owner matches the document ownerId (no share code consulted)', async () => {
    // The owner short-circuit doesn't call getShareLink at all.
    // Asserting the mock wasn't invoked pins that the owner path
    // stays cheap (no D1 round-trip per editor write).
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when there is no owner and no share code', async () => {
    // A guest who hasn't sent X-Owner-Id and didn't follow a
    // share link has no claim on the document at all. Catches a
    // regression that defaulted to "true" if both inputs were
    // null/empty.
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, null, 'owner-a');
    expect(allowed).toBe(false);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when the share code does not resolve (revoked / nonexistent)', async () => {
    // A code that was once valid but has been revoked returns
    // null from getShareLink. The viewer / editor must be denied
    // even if the URL still carries the code.
    getShareLinkMock.mockResolvedValue(null);
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false when the share code maps to a DIFFERENT document (link mismatch)', async () => {
    // The link.documentId guard is the second crucial check: a
    // legit edit-role code for diag-2 must NOT grant access to
    // diag-1. Catches a regression that dropped the document-id
    // verification.
    getShareLinkMock.mockResolvedValue({
      code: 'ABC23456',
      role: 'edit',
      documentId: 'diag-2',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false for a VIEW-role code (read access is not write access)', async () => {
    // The fix in commit 069b785 opened reads to view-role
    // visitors via canReadDocument. Writes must stay edit-only:
    // a view code carrying the same documentId still returns
    // false here.
    getShareLinkMock.mockResolvedValue({
      code: 'VIEW2345',
      role: 'view',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns true for an EDIT-role code matching the document', async () => {
    getShareLinkMock.mockResolvedValue({
      code: 'EDIT2345',
      role: 'edit',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a');
    expect(allowed).toBe(true);
  });

  it('returns true when the resolved owner DOES match even if a share code is also present', async () => {
    // A signed-in owner clicking their own share link still
    // identifies as owner via the Bearer / X-Owner-Id header.
    // The owner short-circuit fires first; the link isn't even
    // consulted. Pins that owner identity takes precedence.
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', 'owner-a', 'ANY2345A', 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/share-roles.md: the ladder, view < participate < edit.
describe('canParticipateDocument', () => {
  const link = (role: ShareLink['role']): ShareLink => ({
    code: 'CODE2345',
    role,
    documentId: 'diag-1',
    createdAt: 0,
    expiry: 'never',
    expiresAt: null,
    purpose: 'share',
    tabId: null,
  });

  it('admits a Participant and an Editor link, and the owner; refuses a Viewer', async () => {
    for (const [role, admitted] of [
      ['participate', true],
      ['edit', true],
      ['view', false],
    ] as const) {
      getShareLinkMock.mockResolvedValue(link(role));
      expect(await canParticipateDocument(FAKE_ENV, 'diag-1', null, 'CODE2345', 'owner-a')).toBe(
        admitted,
      );
    }
    expect(await canParticipateDocument(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a')).toBe(true);
  });

  it('keeps a Participant link off edit doors and on read doors', async () => {
    getShareLinkMock.mockResolvedValue(link('participate'));
    expect(await canEditDocument(FAKE_ENV, 'diag-1', null, 'CODE2345', 'owner-a')).toBe(false);
    expect(await canReadDocument(FAKE_ENV, 'diag-1', null, 'CODE2345', 'owner-a')).toBe(true);
  });
});

describe('canReadDocument', () => {
  it('returns true when owner matches (no share code consulted)', async () => {
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a');
    expect(allowed).toBe(true);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when there is no owner and no share code', async () => {
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, null, 'owner-a');
    expect(allowed).toBe(false);
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });

  it('returns false when the share code is revoked / nonexistent', async () => {
    getShareLinkMock.mockResolvedValue(null);
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns false when the share code maps to a DIFFERENT document', async () => {
    // Same document-id guard as canEditDocument. A read on diag-1
    // with a code for diag-2 must still 403.
    getShareLinkMock.mockResolvedValue({
      code: 'ABC23456',
      role: 'view',
      documentId: 'diag-2',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, 'ABC23456', 'owner-a');
    expect(allowed).toBe(false);
  });

  it('returns true for a VIEW-role code matching the document (the load-bearing case)', async () => {
    // The whole reason this helper exists. The fix in commit
    // 069b785 found that GET /api/documents/:id/tabs/:tabId was
    // gated on canEditDocument, so view-only visitors got a 403
    // and saw every tab blank. canReadDocument opens reads to
    // view-role visitors; the test pins that view IS allowed.
    getShareLinkMock.mockResolvedValue({
      code: 'VIEW2345',
      role: 'view',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a');
    expect(allowed).toBe(true);
  });

  it('returns true for an EDIT-role code matching the document (edit is read-and-write)', async () => {
    // Edit role is a superset of view: anyone with an edit code
    // also has read access. The role check in canEditDocument is
    // the only place where role: 'view' is treated differently.
    getShareLinkMock.mockResolvedValue({
      code: 'EDIT2345',
      role: 'edit',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a');
    expect(allowed).toBe(true);
  });
});

describe('share password gate (docs/specs/013-workspace/share-password.md)', () => {
  // A valid edit-role code for diag-1 in every case below; the password
  // is what flips access.
  const editLink: ShareLink = {
    code: 'EDIT2345',
    role: 'edit',
    documentId: 'diag-1',
    createdAt: 0,
    expiry: 'never',
    expiresAt: null,
    purpose: 'share',
    tabId: null,
  };

  it('denies a share-code edit when the password is required but absent', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', null, 'EDIT2345', 'owner-a', null);
    expect(allowed).toBe(false);
  });

  it('denies a share-code edit when the password is wrong', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDocument(
      FAKE_ENV,
      'diag-1',
      null,
      'EDIT2345',
      'owner-a',
      pw('nope'),
    );
    expect(allowed).toBe(false);
  });

  it('allows a share-code edit when the password matches', async () => {
    getShareLinkMock.mockResolvedValue(editLink);
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDocument(
      FAKE_ENV,
      'diag-1',
      null,
      'EDIT2345',
      'owner-a',
      pw('hunter2'),
    );
    expect(allowed).toBe(true);
  });

  it('denies a view read on a protected document without the password', async () => {
    getShareLinkMock.mockResolvedValue({ ...editLink, code: 'VIEW2345', role: 'view' });
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canReadDocument(FAKE_ENV, 'diag-1', null, 'VIEW2345', 'owner-a', null);
    expect(allowed).toBe(false);
  });

  it('allows a view read on a protected document with the matching password', async () => {
    getShareLinkMock.mockResolvedValue({ ...editLink, code: 'VIEW2345', role: 'view' });
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canReadDocument(
      FAKE_ENV,
      'diag-1',
      null,
      'VIEW2345',
      'owner-a',
      pw('hunter2'),
    );
    expect(allowed).toBe(true);
  });

  it('never consults the password for the owner (bypass stays cheap)', async () => {
    // Owner short-circuit must fire before any password lookup, so an
    // owner is never locked out of their own document.
    getSharePasswordMock.mockResolvedValue('hunter2');
    const allowed = await canEditDocument(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a', null);
    expect(allowed).toBe(true);
    expect(getSharePasswordMock).not.toHaveBeenCalled();
  });
});

describe('team-library access (docs/specs/013-workspace/team-shared-documents.md)', () => {
  // Membership is checked against the VERIFIED callerId (8th arg), the
  // Clerk user id — NOT the hybrid `owner` (3rd arg, which may be the
  // unsigned X-Owner-Id header). The member here is a guest-shaped
  // `owner` (null) with a verified callerId to prove that's what counts.
  it('grants edit to a JOINED member of the document team', async () => {
    getMembershipMock.mockResolvedValue({ status: 'joined' });
    const allowed = await canEditDocument(
      FAKE_ENV,
      'diag-1',
      null,
      null,
      'owner-a',
      null,
      'team-1',
      'user-1',
    );
    expect(allowed).toBe(true);
    expect(getMembershipMock).toHaveBeenCalledWith(FAKE_ENV, 'team-1', 'user-1');
  });

  it('grants read to a JOINED member of the document team', async () => {
    getMembershipMock.mockResolvedValue({ status: 'joined' });
    const allowed = await canReadDocument(
      FAKE_ENV,
      'diag-1',
      null,
      null,
      'owner-a',
      null,
      'team-1',
      'user-1',
    );
    expect(allowed).toBe(true);
  });

  // Security: a forged X-Owner-Id header (member id in `owner`) with NO
  // verified Clerk session (callerId null) must NOT pass — otherwise a
  // removed member could forge a current member's id. Membership is
  // never even consulted (callerId is null).
  it('denies a forged owner-id header with no verified caller on a team document', async () => {
    getMembershipMock.mockClear();
    getMembershipMock.mockResolvedValue({ status: 'joined' });
    expect(
      await canEditDocument(FAKE_ENV, 'diag-1', 'user-1', null, 'owner-a', null, 'team-1', null),
    ).toBe(false);
    expect(
      await canReadDocument(FAKE_ENV, 'diag-1', 'owner-a', null, 'owner-a', null, 'team-1', null),
    ).toBe(false);
    expect(getMembershipMock).not.toHaveBeenCalled();
  });

  it('denies an INVITED (un-accepted) member', async () => {
    getMembershipMock.mockResolvedValue({ status: 'invited' });
    const allowed = await canEditDocument(
      FAKE_ENV,
      'diag-1',
      null,
      null,
      'owner-a',
      null,
      'team-1',
      'user-1',
    );
    expect(allowed).toBe(false);
  });

  it('grants the team document’s owner access only while they are a joined member', async () => {
    // Owning the row used to be enough on its own, so a member the team
    // removed kept full access to everything they had created in it (docs/specs/013-workspace/team-shared-documents.md).
    getMembershipMock.mockResolvedValue({ status: 'joined' });
    expect(
      await canEditDocument(FAKE_ENV, 'diag-1', null, null, 'user-1', null, 'team-1', 'user-1'),
    ).toBe(true);
    getMembershipMock.mockResolvedValue(null);
    expect(
      await canEditDocument(FAKE_ENV, 'diag-1', null, null, 'user-1', null, 'team-1', 'user-1'),
    ).toBe(false);
    expect(
      await canReadDocument(FAKE_ENV, 'diag-1', null, null, 'user-1', null, 'team-1', 'user-1'),
    ).toBe(false);
  });

  it('denies a non-member, and never consults membership when the document has no team', async () => {
    getMembershipMock.mockResolvedValue(null);
    expect(
      await canEditDocument(FAKE_ENV, 'diag-1', null, null, 'owner-a', null, 'team-1', 'user-2'),
    ).toBe(false);
    getMembershipMock.mockClear();
    expect(
      await canEditDocument(FAKE_ENV, 'diag-1', 'user-2', null, 'owner-a', null, null, 'user-2'),
    ).toBe(false);
    expect(getMembershipMock).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md. A scoped link grants its role on ONE tab. The gates
// fail closed: a request that names no tab (a document-level door) is refused a
// scoped link, and only the doors that know how to narrow what they return ask
// for the grant itself.
describe('tab-scoped links', () => {
  const scoped = (role: 'edit' | 'view', tabId: string | null = 'tab-2'): ShareLink => ({
    code: 'SCOPED23',
    role,
    documentId: 'diag-1',
    createdAt: 0,
    expiry: 'never',
    expiresAt: null,
    purpose: 'share',
    tabId,
  });
  const read = (tab?: string) =>
    canReadDocument(FAKE_ENV, 'diag-1', null, 'SCOPED23', 'owner-a', null, null, null, tab);
  const edit = (tab?: string) =>
    canEditDocument(FAKE_ENV, 'diag-1', null, 'SCOPED23', 'owner-a', null, null, null, tab);

  it('opens its own tab', async () => {
    getShareLinkMock.mockResolvedValue(scoped('edit'));
    expect(await read('tab-2')).toBe(true);
    expect(await edit('tab-2')).toBe(true);
  });

  it('refuses every other tab', async () => {
    getShareLinkMock.mockResolvedValue(scoped('edit'));
    expect(await read('tab-1')).toBe(false);
    expect(await edit('tab-1')).toBe(false);
  });

  it('refuses a document-level door, which names no tab', async () => {
    getShareLinkMock.mockResolvedValue(scoped('edit'));
    expect(await read()).toBe(false);
    expect(await edit()).toBe(false);
  });

  it('keeps the role: a scoped view link still cannot write its own tab', async () => {
    getShareLinkMock.mockResolvedValue(scoped('view'));
    expect(await read('tab-2')).toBe(true);
    expect(await edit('tab-2')).toBe(false);
  });

  it('leaves an All-tabs link opening any tab and the document itself', async () => {
    getShareLinkMock.mockResolvedValue(scoped('edit', null));
    expect(await read('tab-1')).toBe(true);
    expect(await edit()).toBe(true);
  });

  it('leaves the owner opening any tab', async () => {
    expect(
      await canEditDocument(
        FAKE_ENV,
        'diag-1',
        'owner-a',
        null,
        'owner-a',
        null,
        null,
        null,
        'tab-9',
      ),
    ).toBe(true);
  });
});

describe('resolveDocumentGrant', () => {
  const grant = (owner: string | null, code: string | null, password: string | null = null) =>
    resolveDocumentGrant(
      FAKE_ENV,
      'diag-1',
      owner,
      code,
      'owner-a',
      password === null ? null : pw(password),
      null,
      null,
    );

  it('grants the owner edit on every tab', async () => {
    expect(await grant('owner-a', null)).toEqual({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      community: false,
    });
  });

  it('grants a joined team member edit on every tab', async () => {
    getMembershipMock.mockResolvedValue({ status: 'joined' });
    expect(
      await resolveDocumentGrant(
        FAKE_ENV,
        'diag-1',
        'x',
        null,
        'owner-a',
        null,
        'team-1',
        'user-1',
      ),
    ).toEqual({ role: 'edit', tabScope: null, shareCode: null, community: false });
  });

  it("hands back a share link's role and scope", async () => {
    getShareLinkMock.mockResolvedValue({
      code: 'SCOPED23',
      role: 'view',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: 'tab-2',
    });
    expect(await grant(null, 'SCOPED23')).toEqual({
      role: 'view',
      tabScope: 'tab-2',
      shareCode: 'SCOPED23',
      community: false,
    });
  });

  it("opens a hidden post's link to nobody but an operator", async () => {
    const community = {
      code: 'POSTLINK',
      role: 'view' as const,
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never' as const,
      expiresAt: null,
      purpose: 'community' as const,
      tabId: null,
    };
    getShareLinkMock.mockResolvedValue(community);
    communityLinkAccessMock.mockResolvedValueOnce('closed');
    expect(await grant(null, 'POSTLINK')).toBeNull();
    // Closed for everyone, signed in or not: nobody reviews a hidden post.
    communityLinkAccessMock.mockResolvedValueOnce('closed');
    expect(
      await resolveDocumentGrant(
        FAKE_ENV,
        'diag-1',
        null,
        'POSTLINK',
        'owner-a',
        null,
        null,
        'user_x',
      ),
    ).toBeNull();
    communityLinkAccessMock.mockResolvedValueOnce(null);
    expect(await grant(null, 'POSTLINK')).toBeNull();
  });

  it('lets a Community link read only through a door that serves one', async () => {
    getShareLinkMock.mockResolvedValue({
      code: 'POSTLINK',
      role: 'view',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'community',
      tabId: null,
    });
    expect(await canReadDocument(FAKE_ENV, 'diag-1', null, 'POSTLINK', 'owner-a')).toBe(false);
    expect(
      await canReadDocument(
        FAKE_ENV,
        'diag-1',
        null,
        'POSTLINK',
        'owner-a',
        null,
        null,
        null,
        undefined,
        true,
      ),
    ).toBe(true);
  });

  it("marks a Community post's link as a community grant (docs/specs/025-community/community.md)", async () => {
    getShareLinkMock.mockResolvedValue({
      code: 'POSTLINK',
      role: 'view',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'community',
      tabId: null,
    });
    expect(await grant(null, 'POSTLINK')).toEqual({
      role: 'view',
      tabScope: null,
      shareCode: 'POSTLINK',
      community: true,
    });
  });

  it('grants nothing without a matching password', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    getShareLinkMock.mockResolvedValue({
      code: 'SCOPED23',
      role: 'edit',
      documentId: 'diag-1',
      createdAt: 0,
      expiry: 'never',
      expiresAt: null,
      purpose: 'share',
      tabId: null,
    });
    expect(await grant(null, 'SCOPED23', 'wrong')).toBeNull();
  });

  it('grants nothing to a stranger', async () => {
    expect(await grant(null, null)).toBeNull();
  });
});
