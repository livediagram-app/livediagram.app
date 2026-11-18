import { beforeEach, describe, expect, it } from 'vitest';
import { prefixOf, type ItemTypeCatalogue } from '@liveplanner/items';
import { getProject } from '../db';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/item-types.md "Card number prefixes": the api stores a new type's prefix and keeps every other
// type's when a change would shift it, refuses one another type has, and only an Editor of the whole plan changes one
// (docs/specs/013-workspace/share-roles.md); a Participant and a Viewer never do.

let sql: SqliteD1;

async function putTypes(itemTypes: unknown, as: { owner?: string; code?: string } = {}) {
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

const type = (id: string, label: string, prefix?: string) => ({
  id,
  label,
  color: '#71717a',
  glyph: 'task',
  fields: ['description'],
  ...(prefix !== undefined ? { prefix } : {}),
});
const catalogue = (...types: unknown[]) => ({ version: 1, types });
const stored = async () => (await getProject(sql.env, 'd1'))!.itemTypes!.types;

const EDIT = { owner: 'e', code: 'EDIT' };
const PART = { owner: 'p', code: 'PART' };
const VIEW = { owner: 'v', code: 'VIEW' };

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
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
  `);
});

describe('card prefixes through the api', () => {
  it('stores each new type’s prefix, made from its name', async () => {
    const res = await putTypes(catalogue(type('task', 'Task'), type('wi', 'Work Item')));
    expect(res.status).toBe(200);
    expect(res.body.itemTypes.types.map((t) => t.prefix)).toEqual(['T', 'WI']);
    expect((await stored()).map((t) => t.prefix)).toEqual(['T', 'WI']);
  });

  it('keeps a type’s prefix when another change would shift it, and when it is renamed', async () => {
    // A plan from before prefixes: none stored.
    await setPlanItemTypes(
      sql.env,
      'd1',
      catalogue(type('task', 'Task'), type('theme', 'Theme')) as ItemTypeCatalogue,
      undefined,
    );
    expect((await putTypes(catalogue(type('theme', 'Theme')))).status).toBe(200);
    expect(prefixOf(await stored(), 'theme')).toBe('TH');
    // A type with no stored prefix, renamed: it keeps the one its old name made.
    await setPlanItemTypes(sql.env, 'd1', catalogue(type('task', 'Task')) as ItemTypeCatalogue);
    expect((await putTypes(catalogue(type('task', 'Chore')))).status).toBe(200);
    expect((await stored())[0]!.prefix).toBe('T');
  });

  it('lets a type sent without its stored prefix go back to the one its name makes', async () => {
    await putTypes(catalogue(type('wi', 'Work Item', 'W')));
    expect((await putTypes(catalogue(type('wi', 'Work Item')))).status).toBe(200);
    expect((await stored())[0]!.prefix).toBeUndefined();
    expect(prefixOf(await stored(), 'wi')).toBe('WI');
  });

  it('refuses a prefix another type has, keeping the last good catalogue', async () => {
    await putTypes(catalogue(type('task', 'Task'), type('note', 'Note')));
    expect(
      await putTypes(catalogue(type('task', 'Task', 'T'), type('note', 'Note', 't'))),
    ).toMatchObject({
      status: 400,
      body: { reason: 'types[1].prefix' },
    });
    expect(
      await putTypes(catalogue(type('task', 'Task', 'T'), type('note', 'Note', 'n-1'))),
    ).toMatchObject({
      status: 400,
      body: { reason: 'types[1].prefix' },
    });
    expect((await stored()).map((t) => t.prefix)).toEqual(['T', 'N']);
  });

  it('lets an Editor change a prefix, and never a Participant or a Viewer', async () => {
    await putTypes(catalogue(type('task', 'Task')));
    for (const as of [PART, VIEW])
      expect((await putTypes(catalogue(type('task', 'Task', 'TK')), as)).status, as.code).toBe(403);
    expect((await stored())[0]!.prefix).toBe('T');
    expect((await putTypes(catalogue(type('task', 'Task', 'tk')), EDIT)).status).toBe(200);
    expect((await stored())[0]!.prefix).toBe('TK');
  });
});
