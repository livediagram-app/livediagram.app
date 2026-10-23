import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeSql } from './test-sqlite';
import {
  createImageGrants,
  editorsOfKeys,
  ensureImageGrantSchema,
  imageGrantSqlOf,
  type ImageGrantDeps,
} from './image-grants';

// Which images an item may serve: its owner's, an entitled person's (an editor since the last push, a joined
// teammate), and those it holds a grant for, in the item's own SQLite.

let exec: ReturnType<typeof nodeSql>;
let owners: Map<string, string>;
let members: Map<string, string[]>;
let deps: ImageGrantDeps & {
  lookupOwner: ReturnType<typeof vi.fn>;
  teamMembers: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  exec = nodeSql();
  ensureImageGrantSchema(exec);
  owners = new Map();
  members = new Map();
  deps = {
    lookupOwner: vi.fn(async (id: string) => owners.get(id) ?? null),
    // A guest is named by a hash at the media service; an account by its id.
    mediaOwnerOf: async (id: string) => (id.startsWith('guest-') ? `h:${id}` : id),
    teamMembers: vi.fn(async (team: string) => members.get(team) ?? []),
  };
});

const sql = () => imageGrantSqlOf(exec);
const granted = () =>
  (
    exec.exec('SELECT image_id FROM image_grants ORDER BY image_id').toArray() as {
      image_id: string;
    }[]
  ).map((r) => r.image_id);
const ada = { ownerId: 'user_ada', teamId: null };

describe('servableImageIds', () => {
  it("serves the owner's own images, and refuses anyone else's and unknown ids", async () => {
    owners.set('mine', 'user_ada').set('bobs', 'user_bob');
    const g = createImageGrants(deps);
    expect([...(await g.servableImageIds(sql(), ada, ['mine', 'bobs', 'nope'], []))]).toEqual([
      'mine',
    ]);
  });

  it('names a guest owner as the media service does', async () => {
    owners.set('g', 'h:guest-1');
    const g = createImageGrants(deps);
    const item = { ownerId: 'guest-1', teamId: null };
    expect([...(await g.servableImageIds(sql(), item, ['g'], []))]).toEqual(['g']);
  });

  it('serves the images of someone who wrote since the last push, read only when needed', async () => {
    owners.set('bobs', 'user_bob').set('mine', 'user_ada');
    const g = createImageGrants(deps);
    const keys = vi.fn(async () => ['user_bob@1']);
    expect([...(await g.servableImageIds(sql(), ada, ['mine'], keys))]).toEqual(['mine']);
    expect(keys).not.toHaveBeenCalled();
    expect([...(await g.servableImageIds(sql(), ada, ['bobs'], keys))]).toEqual(['bobs']);
  });

  it("serves a joined teammate's images, remembering the team for a while", async () => {
    owners.set('bobs', 'user_bob').set('cys', 'user_cy');
    members.set('t1', ['user_ada', 'user_bob']);
    let at = 0;
    const g = createImageGrants(deps, { now: () => at, teamTtlMs: 1_000 });
    const item = { ownerId: 'user_ada', teamId: 't1' };
    expect([...(await g.servableImageIds(sql(), item, ['bobs', 'cys'], []))]).toEqual(['bobs']);
    await g.servableImageIds(sql(), item, ['cys'], []);
    expect(deps.teamMembers).toHaveBeenCalledTimes(1);
    at = 2_000;
    await g.servableImageIds(sql(), item, ['cys'], []);
    expect(deps.teamMembers).toHaveBeenCalledTimes(2);
  });

  it('asks the service once per image, then answers from the item', async () => {
    owners.set('a', 'user_ada').set('b', 'user_ada');
    const g = createImageGrants(deps);
    await g.servableImageIds(sql(), ada, ['a', 'b', 'x'], []);
    await g.servableImageIds(sql(), ada, ['a', 'b', 'x'], []);
    expect(deps.lookupOwner).toHaveBeenCalledTimes(3);
  });

  it('answers 500 placed images within budget', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `img-${i}`);
    for (const id of ids) owners.set(id, 'user_bob');
    members.set('t1', ['user_bob']);
    const g = createImageGrants(deps);
    const item = { ownerId: 'user_ada', teamId: 't1' };
    const cold = performance.now();
    expect((await g.servableImageIds(sql(), item, ids, [])).size).toBe(500);
    const coldMs = performance.now() - cold;
    const warm = performance.now();
    expect((await g.servableImageIds(sql(), item, ids, [])).size).toBe(500);
    const warmMs = performance.now() - warm;
    expect(coldMs).toBeLessThan(2_000);
    expect(warmMs).toBeLessThan(100);
  });
});

describe('grants', () => {
  it("grants an editor's placed images and keeps serving them once the editor is gone", async () => {
    owners.set('bobs', 'user_bob');
    const g = createImageGrants(deps);
    expect(await g.grantPlaced(sql(), ada, ['bobs'], ['user_bob@1'], 1)).toBe(1);
    expect(granted()).toEqual(['bobs']);
    expect([...(await g.servableImageIds(sql(), ada, ['bobs'], []))]).toEqual(['bobs']);
  });

  it('grants nothing for an image its owner may not place here, nor the owner’s own', async () => {
    owners.set('mine', 'user_ada').set('pasted', 'user_mallory');
    const g = createImageGrants(deps);
    expect(await g.grantPlaced(sql(), ada, ['mine', 'pasted'], ['user_bob@1'], 1)).toBe(0);
    expect(granted()).toEqual([]);
  });

  it('grants outright, idempotently (a copy)', async () => {
    const g = createImageGrants(deps);
    await g.grant(sql(), ['a', 'b'], 1);
    await g.grant(sql(), ['a'], 2);
    expect(granted()).toEqual(['a', 'b']);
  });

  it('reads the people edit keys name', () => {
    expect(editorsOfKeys(['user_bob@1', 'a@b@2', '@3'])).toEqual(['user_bob', 'a@b']);
  });
});
