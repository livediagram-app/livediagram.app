import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemTypeCatalogue } from '@liveplanner/items';
import { getProject } from '../db';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/item-types.md "Inherited types": the api stores every inherited type resolved against its base,
// detaches the types of a deleted base, refuses a chain, and only a whole-plan Editor changes card types
// (docs/specs/013-workspace/share-roles.md).

let sql: SqliteD1;

async function put(itemTypes: unknown, as: { owner?: string; code?: string } = {}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext('PUT', '/api/projects/d1/item-types', {
    env: sql.env,
    owner: as.owner ?? 'owner',
    ...(as.code ? { headers: { 'X-Share-Code': as.code } } : {}),
    body: { itemTypes },
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return {
    status: res.status,
    body: (text ? JSON.parse(text) : null) as { itemTypes: ItemTypeCatalogue; reason?: string },
  };
}

const WORK = {
  id: 'work',
  label: 'Work',
  color: '#71717a',
  glyph: 'task',
  fields: ['description', 'f-area', 'f-blocked-by'],
  custom: [
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'] },
    {
      id: 'f-blocked-by',
      label: 'Blocked By',
      kind: 'card',
      linkType: 'work',
      multiple: true,
      blocks: true,
    },
  ],
  statuses: ['todo', 'done'],
  defaultStatus: 'todo',
};
const BUG = {
  id: 'bug',
  label: 'Bug',
  color: '#dc2626',
  glyph: 'bug',
  fields: ['f-severity'],
  custom: [{ id: 'f-severity', label: 'Severity', kind: 'number' }],
  inherits: 'work',
};
const catalogue = (...types: unknown[]) => ({ version: 1, types });
const stored = async () => (await getProject(sql.env, 'd1'))!.itemTypes!.types;

beforeEach(() => {
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
});

describe('inherited card types through the api', () => {
  it('stores an inherited type resolved, every inherited field’s settings with it', async () => {
    const res = await put(catalogue(WORK, BUG));
    expect(res.status).toBe(200);
    const bug = res.body.itemTypes.types[1]!;
    expect(bug.fields).toEqual([
      'title',
      'status',
      'description',
      'f-area',
      'f-blocked-by',
      'f-severity',
    ]);
    expect(bug.custom!.find((c) => c.id === 'f-blocked-by')).toMatchObject({ blocks: true });
    expect(bug).toMatchObject({
      statuses: ['todo', 'done'],
      defaultStatus: 'todo',
      inherits: 'work',
    });
    expect(bug.ownFields).toEqual(['f-severity']);
    expect((await stored())[1]).toEqual(bug);
  });

  it('flows a base change to the stored inherited type', async () => {
    const first = await put(catalogue(WORK, BUG));
    const [work, bug] = first.body.itemTypes.types;
    await put(catalogue({ ...work, fields: [...work!.fields, 'due'], statuses: ['done'] }, bug));
    const after = (await stored())[1]!;
    expect(after.fields).toContain('due');
    expect(after.statuses).toEqual(['done']);
    expect(after.ownFields).toEqual(['f-severity']);
  });

  it('detaches the types of a deleted base, each keeping its fields', async () => {
    const [, bug] = (await put(catalogue(WORK, BUG))).body.itemTypes.types;
    expect((await put(catalogue(bug))).status).toBe(200);
    const left = (await stored())[0]!;
    expect(left.inherits).toBeUndefined();
    expect(left.fields).toEqual(bug!.fields);
  });

  it('refuses a chain by name and keeps the last good catalogue', async () => {
    await put(catalogue(WORK, BUG));
    const story = { ...BUG, id: 'story', label: 'Story', inherits: 'bug' };
    expect(await put(catalogue(WORK, BUG, story))).toMatchObject({
      status: 400,
      body: { error: 'item_types_invalid', reason: 'types[2].inherits' },
    });
    expect(await stored()).toHaveLength(2);
  });

  it('lets only an Editor of the whole plan give a type a base or detach it', async () => {
    expect((await put(catalogue(WORK, BUG), { owner: 'v', code: 'VIEW' })).status).toBe(403);
    expect((await put(catalogue(WORK, BUG), { owner: 'p', code: 'PART' })).status).toBe(403);
    expect((await put(catalogue(WORK, BUG), { owner: 't', code: 'TAB1' })).status).toBe(403);
    expect((await put(catalogue(WORK, BUG), { owner: 'e', code: 'EDIT' })).status).toBe(200);
    const [work, bug] = await stored();
    const { inherits: _base, ...detached } = bug!;
    expect((await put(catalogue(work, detached), { owner: 'p', code: 'PART' })).status).toBe(403);
    expect((await stored())[1]!.inherits).toBe('work');
  });
});
