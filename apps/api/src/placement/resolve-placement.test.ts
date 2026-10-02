import { describe, expect, it, vi } from 'vitest';
import {
  judgeFolder,
  judgeTeam,
  parsePlacement,
  resolvePlacement,
  type PlacementLookups,
} from './resolve-placement';

// Placement on create (docs/specs/013-workspace/folders.md "Placement on create",
// blueprint docs/specs/013-workspace/blueprints/document-placement.md).

const guest = { ownerId: 'guest-uuid', verifiedUserId: null };
const alice = { ownerId: 'user_alice', verifiedUserId: 'user_alice' };

function lookups(over: Partial<PlacementLookups> = {}): PlacementLookups {
  return {
    isJoinedMember: vi.fn(async () => false),
    getFolder: vi.fn(async () => null),
    ...over,
  };
}

describe('parsePlacement', () => {
  it('reads an absent placement as the personal root', () => {
    expect(parsePlacement({})).toEqual({ teamId: null, folderId: null });
  });

  it('reads null as absent', () => {
    expect(parsePlacement({ teamId: null, folderId: null })).toEqual({
      teamId: null,
      folderId: null,
    });
  });

  it('keeps string ids', () => {
    expect(parsePlacement({ teamId: 't1', folderId: 'f1' })).toEqual({
      teamId: 't1',
      folderId: 'f1',
    });
  });

  it.each([
    ['a number team', { teamId: 7 }],
    ['an object folder', { folderId: { id: 'f1' } }],
    ['an empty team', { teamId: '' }],
    ['an empty folder', { folderId: '' }],
  ])('refuses %s', (_label, body) => {
    expect(parsePlacement(body)).toBeNull();
  });
});

describe('judgeTeam', () => {
  it('admits a joined member by verified id', () => {
    expect(judgeTeam('user_alice', true)).toBe('ok');
  });

  it('refuses a guest whatever the membership says', () => {
    expect(judgeTeam(null, true)).toBe('team_forbidden');
  });

  it('refuses a verified caller who has not joined', () => {
    expect(judgeTeam('user_alice', false)).toBe('team_forbidden');
  });
});

describe('judgeFolder', () => {
  const personal = { teamId: null };
  const team = { teamId: 't1' };

  it('refuses a missing folder', () => {
    expect(judgeFolder(null, personal, alice, false)).toBe('folder_not_found');
  });

  it("places into the caller's own personal folder", () => {
    expect(judgeFolder({ ownerId: 'user_alice', teamId: null }, personal, alice, false)).toBe('ok');
  });

  it("hides someone else's personal folder", () => {
    expect(judgeFolder({ ownerId: 'user_bob', teamId: null }, personal, alice, false)).toBe(
      'folder_not_found',
    );
  });

  it("places into the team's own folder", () => {
    expect(judgeFolder({ ownerId: 'user_bob', teamId: 't1' }, team, alice, false)).toBe('ok');
  });

  it('names a mismatch for their own personal folder asked for in a team', () => {
    expect(judgeFolder({ ownerId: 'user_alice', teamId: null }, team, alice, false)).toBe(
      'folder_scope_mismatch',
    );
  });

  it('names a mismatch for a joined team folder asked for in Personal Space', () => {
    expect(judgeFolder({ ownerId: 'user_bob', teamId: 't2' }, personal, alice, true)).toBe(
      'folder_scope_mismatch',
    );
  });

  it('names a mismatch for a joined team folder asked for in another team', () => {
    expect(judgeFolder({ ownerId: 'user_bob', teamId: 't2' }, team, alice, true)).toBe(
      'folder_scope_mismatch',
    );
  });

  it('hides a folder of a team the caller has not joined', () => {
    expect(judgeFolder({ ownerId: 'user_bob', teamId: 't2' }, personal, alice, false)).toBe(
      'folder_not_found',
    );
  });
});

describe('resolvePlacement', () => {
  it('files at the personal root when nothing is asked for', async () => {
    const l = lookups();
    expect(await resolvePlacement({ teamId: null, folderId: null }, guest, l)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: null },
      via: 'root',
    });
    expect(l.getFolder).not.toHaveBeenCalled();
    expect(l.isJoinedMember).not.toHaveBeenCalled();
  });

  it("files into a guest's own personal folder", async () => {
    const l = lookups({ getFolder: vi.fn(async () => ({ ownerId: 'guest-uuid', teamId: null })) });
    expect(await resolvePlacement({ teamId: null, folderId: 'f1' }, guest, l)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: 'f1' },
      via: 'explicit',
    });
  });

  it('refuses a folder that does not exist', async () => {
    expect(await resolvePlacement({ teamId: null, folderId: 'gone' }, alice, lookups())).toEqual({
      ok: false,
      rejection: 'folder_not_found',
    });
  });

  it("files at a team's root for a joined member", async () => {
    const l = lookups({ isJoinedMember: vi.fn(async () => true) });
    expect(await resolvePlacement({ teamId: 't1', folderId: null }, alice, l)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: null },
      via: 'root',
    });
    expect(l.isJoinedMember).toHaveBeenCalledWith('t1', 'user_alice');
  });

  it("files into a team's folder for a joined member", async () => {
    const l = lookups({
      isJoinedMember: vi.fn(async () => true),
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })),
    });
    expect(await resolvePlacement({ teamId: 't1', folderId: 'tf1' }, alice, l)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: 'tf1' },
      via: 'explicit',
    });
  });

  it('refuses a team the caller has not joined, before looking at the folder', async () => {
    const l = lookups({ getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })) });
    expect(await resolvePlacement({ teamId: 't1', folderId: 'tf1' }, alice, l)).toEqual({
      ok: false,
      rejection: 'team_forbidden',
    });
    expect(l.getFolder).not.toHaveBeenCalled();
  });

  it('refuses a guest asking for a team without reading membership', async () => {
    const l = lookups({ isJoinedMember: vi.fn(async () => true) });
    expect(await resolvePlacement({ teamId: 't1', folderId: null }, guest, l)).toEqual({
      ok: false,
      rejection: 'team_forbidden',
    });
    expect(l.isJoinedMember).not.toHaveBeenCalled();
  });

  it('names a folder from another space the caller can see', async () => {
    const l = lookups({
      isJoinedMember: vi.fn(async () => true),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    expect(await resolvePlacement({ teamId: 't1', folderId: 'mine' }, alice, l)).toEqual({
      ok: false,
      rejection: 'folder_scope_mismatch',
    });
  });

  it("checks a team folder's visibility by verified id only", async () => {
    const isJoinedMember = vi.fn(async () => true);
    const l = lookups({
      isJoinedMember,
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't2' })),
    });
    expect(await resolvePlacement({ teamId: null, folderId: 'tf2' }, guest, l)).toEqual({
      ok: false,
      rejection: 'folder_not_found',
    });
    expect(isJoinedMember).not.toHaveBeenCalled();
  });
});
