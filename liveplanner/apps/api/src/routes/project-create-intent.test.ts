import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '@liveplanner/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { copyProject, getProject, listProjectsByOwner } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { asUser } from './placement-test-support';

// The recorded creation intent against a real schema (docs/specs/013-workspace/default-folders.md
// "Recorded intent"): written by the create insert, never rewritten, read back on the summary, null
// (unknown) without an intent and on rows from before it was recorded, carried by a copy.

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
  db.sql.prepare('SELECT opens_in, tab_kind, template_family FROM projects WHERE id = ?').get(id);

async function summary(id: string): Promise<ProjectSummary | undefined> {
  return (await listProjectsByOwner(db.env, 'user_alice')).find((d) => d.id === id);
}

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
    expect(await summary('d1')).toMatchObject({ opensIn: 'plan', folderId: null });
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
        `INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at)
         VALUES ('old', 'user_alice', 'Old', 0, 1, 1)`,
      )
      .run();
    expect(await summary('old')).toMatchObject(UNKNOWN);
  });

  it('records a create naming a retired mode as Plan', async () => {
    await create('d1', { intent: { mode: 'draw' } });
    expect({ ...stored('d1') }).toMatchObject({ opens_in: 'plan' });
  });

  it('reads a row recorded under a retired mode as Plan', async () => {
    await create('d1', { intent: { mode: 'plan', templateFamily: 'retrospective' } });
    db.sql.prepare("UPDATE projects SET opens_in = 'workshop' WHERE id = 'd1'").run();
    expect(await summary('d1')).toMatchObject(RETRO);
  });

  it('reads a stored value outside the enums as unknown', async () => {
    await create('d1', { intent: { mode: 'plan' } });
    db.sql.prepare("UPDATE projects SET opens_in = 'retired' WHERE id = 'd1'").run();
    expect(await summary('d1')).toMatchObject(UNKNOWN);
  });

  it("carries the source's record into a copy", async () => {
    await create('d1', { intent: { mode: 'plan', templateFamily: 'kanban' } });
    await copyProject(db.env, 'd1', 'd2', 'user_alice', 'Copy');
    expect({ ...stored('d2') }).toEqual({
      opens_in: 'plan',
      tab_kind: 'empty',
      template_family: 'kanban',
    });
  });
});
