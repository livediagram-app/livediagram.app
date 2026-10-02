import { describe, expect, it, vi } from 'vitest';
import { judgeFolder, judgeTeam, parsePlacement, resolvePlacement } from './resolve-placement';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import type { PlacementLookups } from './placement-types';
import { judgeDefaultFolder } from './default-folder';

// Placement on create (docs/specs/013-workspace/folders.md "Placement on create",
// blueprint docs/specs/013-workspace/blueprints/document-placement.md).

const guest = { ownerId: 'guest-uuid', verifiedUserId: null };
const alice = { ownerId: 'user_alice', verifiedUserId: 'user_alice' };

function lookups(over: Partial<PlacementLookups> = {}): PlacementLookups {
  return {
    isJoinedMember: vi.fn(async () => false),
    getFolder: vi.fn(async () => null),
    getPlacementDefaults: vi.fn(async () => new Map()),
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
    expect(await resolvePlacement({ teamId: null, folderId: null }, guest, l, null)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: null },
      via: 'root',
      skipped: [],
    });
    expect(l.getFolder).not.toHaveBeenCalled();
    expect(l.isJoinedMember).not.toHaveBeenCalled();
  });

  it("files into a guest's own personal folder", async () => {
    const l = lookups({ getFolder: vi.fn(async () => ({ ownerId: 'guest-uuid', teamId: null })) });
    expect(await resolvePlacement({ teamId: null, folderId: 'f1' }, guest, l, null)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: 'f1' },
      via: 'explicit',
      skipped: [],
    });
  });

  it('refuses a folder that does not exist', async () => {
    expect(
      await resolvePlacement({ teamId: null, folderId: 'gone' }, alice, lookups(), null),
    ).toEqual({
      ok: false,
      rejection: 'folder_not_found',
    });
  });

  it("files at a team's root for a joined member", async () => {
    const l = lookups({ isJoinedMember: vi.fn(async () => true) });
    expect(await resolvePlacement({ teamId: 't1', folderId: null }, alice, l, null)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: null },
      via: 'root',
      skipped: [],
    });
    expect(l.isJoinedMember).toHaveBeenCalledWith('t1', 'user_alice');
  });

  it("files into a team's folder for a joined member", async () => {
    const l = lookups({
      isJoinedMember: vi.fn(async () => true),
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })),
    });
    expect(await resolvePlacement({ teamId: 't1', folderId: 'tf1' }, alice, l, null)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: 'tf1' },
      via: 'explicit',
      skipped: [],
    });
  });

  it('refuses a team the caller has not joined, before looking at the folder', async () => {
    const l = lookups({ getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })) });
    expect(await resolvePlacement({ teamId: 't1', folderId: 'tf1' }, alice, l, null)).toEqual({
      ok: false,
      rejection: 'team_forbidden',
    });
    expect(l.getFolder).not.toHaveBeenCalled();
  });

  it('refuses a guest asking for a team without reading membership', async () => {
    const l = lookups({ isJoinedMember: vi.fn(async () => true) });
    expect(await resolvePlacement({ teamId: 't1', folderId: null }, guest, l, null)).toEqual({
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
    expect(await resolvePlacement({ teamId: 't1', folderId: 'mine' }, alice, l, null)).toEqual({
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
    expect(await resolvePlacement({ teamId: null, folderId: 'tf2' }, guest, l, null)).toEqual({
      ok: false,
      rejection: 'folder_not_found',
    });
    expect(isJoinedMember).not.toHaveBeenCalled();
  });
});

// Default folders (docs/specs/013-workspace/default-folders.md): consulted only at the personal root
// with an intent, the mode key of the intent, a dangling default skipped and never a refusal.
describe('resolvePlacement with default folders', () => {
  const root = { teamId: null, folderId: null };
  const diagram = { mode: 'diagram' } as const;
  const draw = { mode: 'draw' } as const;
  const retro = { mode: 'diagram', boardType: 'retrospective' } as const;
  const defaults = (entries: [PlacementDefaultKey, string][]) =>
    vi.fn(async (): Promise<ReadonlyMap<PlacementDefaultKey, string>> => new Map(entries));

  it("files into the caller's personal default for the intent's mode", async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    expect(await resolvePlacement(root, alice, l, diagram)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: 'f-diagrams' },
      via: 'default',
      key: 'mode:diagram',
      skipped: [],
    });
    expect(l.getPlacementDefaults).toHaveBeenCalledWith('user_alice');
  });

  it('files into a team folder default of a team the caller has joined', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:draw', 'tf-sketches']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })),
      isJoinedMember: vi.fn(async () => true),
    });
    expect(await resolvePlacement(root, alice, l, draw)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: 'tf-sketches' },
      via: 'default',
      key: 'mode:draw',
      skipped: [],
    });
    expect(l.isJoinedMember).toHaveBeenCalledWith('t1', 'user_alice');
  });

  it("uses the key of the intent's mode, not another", async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    const outcome = await resolvePlacement(root, alice, l, draw);
    expect(outcome).toMatchObject({ ok: true, via: 'root', skipped: [] });
    expect(l.getFolder).not.toHaveBeenCalled();
  });

  it('files a guest into its personal default', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:draw', 'f-guest']]),
      getFolder: vi.fn(async () => ({ ownerId: 'guest-uuid', teamId: null })),
    });
    expect(await resolvePlacement(root, guest, l, draw)).toMatchObject({
      ok: true,
      placement: { teamId: null, folderId: 'f-guest' },
      via: 'default',
    });
  });

  it('lets a board default win over the mode default', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([
        ['mode:diagram', 'f-diagrams'],
        ['board:retrospective', 'f-retros'],
      ]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    expect(await resolvePlacement(root, alice, l, retro)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: 'f-retros' },
      via: 'default',
      key: 'board:retrospective',
      skipped: [],
    });
  });

  it('falls through a dangling board default to the mode default', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([
        ['mode:diagram', 'f-diagrams'],
        ['board:retrospective', 'f-gone'],
      ]),
      getFolder: vi.fn(async (id: string) =>
        id === 'f-diagrams' ? { ownerId: 'user_alice', teamId: null } : null,
      ),
    });
    expect(await resolvePlacement(root, alice, l, retro)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: 'f-diagrams' },
      via: 'default',
      key: 'mode:diagram',
      skipped: [{ key: 'board:retrospective', reason: 'folder_missing' }],
    });
  });

  it('files a board with no board default in its mode default', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    expect(await resolvePlacement(root, alice, l, retro)).toMatchObject({
      via: 'default',
      key: 'mode:diagram',
      skipped: [],
    });
  });

  it('never reads the defaults without an intent', async () => {
    const l = lookups({ getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]) });
    expect(await resolvePlacement(root, alice, l, null)).toMatchObject({ ok: true, via: 'root' });
    expect(l.getPlacementDefaults).not.toHaveBeenCalled();
  });

  it('lets an explicit folder win without reading the defaults', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_alice', teamId: null })),
    });
    expect(
      await resolvePlacement({ teamId: null, folderId: 'f-picked' }, alice, l, diagram),
    ).toMatchObject({ ok: true, placement: { folderId: 'f-picked' }, via: 'explicit' });
    expect(l.getPlacementDefaults).not.toHaveBeenCalled();
  });

  it("lets an explicit team's root win without reading the defaults", async () => {
    const l = lookups({
      isJoinedMember: vi.fn(async () => true),
      getPlacementDefaults: defaults([['mode:diagram', 'f-diagrams']]),
    });
    expect(await resolvePlacement({ teamId: 't1', folderId: null }, alice, l, diagram)).toEqual({
      ok: true,
      placement: { teamId: 't1', folderId: null },
      via: 'root',
      skipped: [],
    });
    expect(l.getPlacementDefaults).not.toHaveBeenCalled();
  });

  it('skips a default whose folder is gone and files at the root', async () => {
    const l = lookups({ getPlacementDefaults: defaults([['mode:diagram', 'f-gone']]) });
    expect(await resolvePlacement(root, alice, l, diagram)).toEqual({
      ok: true,
      placement: { teamId: null, folderId: null },
      via: 'root',
      skipped: [{ key: 'mode:diagram', reason: 'folder_missing' }],
    });
  });

  it("skips a personal default that is no longer the caller's", async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:diagram', 'f-carol']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_carol', teamId: null })),
    });
    expect(await resolvePlacement(root, alice, l, diagram)).toMatchObject({
      ok: true,
      via: 'root',
      skipped: [{ key: 'mode:diagram', reason: 'folder_not_visible' }],
    });
  });

  it('skips a default in a team the caller has left', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:draw', 'tf-old']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't9' })),
    });
    expect(await resolvePlacement(root, alice, l, draw)).toMatchObject({
      ok: true,
      placement: { teamId: null, folderId: null },
      via: 'root',
      skipped: [{ key: 'mode:draw', reason: 'team_not_joined' }],
    });
  });

  it('skips a team default on the guest path without reading membership', async () => {
    const l = lookups({
      getPlacementDefaults: defaults([['mode:draw', 'tf']]),
      getFolder: vi.fn(async () => ({ ownerId: 'user_bob', teamId: 't1' })),
      isJoinedMember: vi.fn(async () => true),
    });
    expect(await resolvePlacement(root, guest, l, draw)).toMatchObject({
      via: 'root',
      skipped: [{ key: 'mode:draw', reason: 'team_not_joined' }],
    });
    expect(l.isJoinedMember).not.toHaveBeenCalled();
  });
});

describe('judgeDefaultFolder', () => {
  it('admits the caller’s own personal folder', () => {
    expect(judgeDefaultFolder({ ownerId: 'user_alice', teamId: null }, alice, false)).toBe('ok');
  });

  it('admits a folder of a joined team', () => {
    expect(judgeDefaultFolder({ ownerId: 'user_bob', teamId: 't1' }, alice, true)).toBe('ok');
  });

  it.each([
    ['a missing folder', null, false, 'folder_missing'],
    [
      "someone else's personal folder",
      { ownerId: 'user_bob', teamId: null },
      false,
      'folder_not_visible',
    ],
    [
      'a folder of a team not joined',
      { ownerId: 'user_bob', teamId: 't1' },
      false,
      'team_not_joined',
    ],
  ] as const)('passes over %s', (_label, folder, joined, reason) => {
    expect(judgeDefaultFolder(folder, alice, joined)).toBe(reason);
  });
});
