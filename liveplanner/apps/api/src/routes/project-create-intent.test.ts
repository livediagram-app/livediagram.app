import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getProject } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { asUser } from './test-route-context';

// The recorded creation intent against a real schema (docs/specs/013-workspace/default-folders.md
// "Recorded intent"): written by the create insert, never rewritten, read back on the summary, null
// (unknown) without an intent and on rows from before it was recorded.

let db: SqliteD1;

const UNKNOWN = { opensIn: null, tabKind: null, templateFamily: null };
const RETRO = { opensIn: 'plan', tabKind: 'empty', templateFamily: 'retrospective' };

function create(id: string, extra: Record<string, unknown> = {}) {
  return handleProjects(
    makeTestRouteContext('POST', '/api/projects', {
      env: db.env,
      ...asUser('user_alice'),
      body: { id, name: 'Doc', tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }], ...extra },
    }),
  );
}

const stored = (id: string) =>
  db.sql.prepare('SELECT opens_in, tab_kind, template_family FROM plan WHERE id = ?').get(id);

// The record as a plan read carries it.
const summary = (id: string) => getProject(db.env, id);

beforeEach(() => {
  db = sqliteD1();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recorded creation intent', () => {
  it('records opens-in, tab kind and template family in the create insert', async () => {
    await create('d1', { intent: { mode: 'plan', templateFamily: 'retrospective' } });
    expect({ ...stored('d1') }).toEqual({
      opens_in: 'plan',
      tab_kind: 'empty',
      template_family: 'retrospective',
    });
    expect(await summary('d1')).toMatchObject(RETRO);
  });

  it('records a known intent with no family as made from none', async () => {
    await create('d1', { intent: { mode: 'plan' } });
    expect(await summary('d1')).toMatchObject({
      opensIn: 'plan',
      tabKind: 'empty',
      templateFamily: null,
    });
  });

  it('records nothing for a create without an intent', async () => {
    await create('d1');
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });

  it('records the intent of a create filed at an explicit root', async () => {
    await create('d1', { folderId: null, intent: { mode: 'plan' } });
    expect(await summary('d1')).toMatchObject({ opensIn: 'plan' });
  });

  it('never rewrites the record on a re-commit', async () => {
    await create('d1', { intent: { mode: 'plan' } });
    await create('d1', { intent: { mode: 'plan', templateFamily: 'kanban' } });
    expect(await summary('d1')).toMatchObject({ opensIn: 'plan', templateFamily: null });
  });

  it('exposes the record on the project as well as the summary', async () => {
    await create('d1', { intent: { mode: 'plan', templateFamily: 'retrospective' } });
    expect(await getProject(db.env, 'd1')).toMatchObject(RETRO);
  });

  it('reads a row from before intents were recorded as unknown', async () => {
    db.sql
      .prepare(
        `INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
         VALUES ('old', 'user_alice', 'Old', 0, 1, 1)`,
      )
      .run();
    expect(await summary('old')).toMatchObject(UNKNOWN);
  });

  it('reads a stored value outside the enums as unknown', async () => {
    await create('d1', { intent: { mode: 'plan' } });
    db.sql.prepare("UPDATE plan SET opens_in = 'retired' WHERE id = 'd1'").run();
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });
});
