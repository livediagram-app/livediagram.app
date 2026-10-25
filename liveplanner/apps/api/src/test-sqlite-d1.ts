import { DatabaseSync } from 'node:sqlite';
import { ItemDb } from '@liveworkspace/index-app';
import { migratePlanSchema } from './plan-room/plan-schema';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { AccessLevel } from '@liveplanner/api-schema';
import type { GrantCaller, GrantOutcome, PlanGrant } from './index-service';
import { IndexError, type IndexClient, type ShareAccess } from '@liveworkspace/index-client';
import type { Env, PlanEnv } from './types';

// The plans' storage for tests (docs/specs/015-api/api.md "Storage"): each plan's own SQLite is its Durable
// Object's in production; here every plan's tables sit in one in-memory node:sqlite database behind `env.PLAN_DB`,
// so a test arranges and asserts on them through one handle, and a handler runs as it does inside a plan's object.
// Foreign keys are on, as in a Durable Object. `env.PLAN_ROOM` answers the plan RPCs (plan-client.ts) from those
// same tables, and hands `fetch` (the room's relays) to the PLAN_ROOM the test passed, if any. `flush` drains what
// the plans owe the index (plan-outbox.ts) now.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

export type SqliteD1 = {
  // The worker's bindings and the plans' (PLAN_DB): every content module runs against it.
  env: PlanEnv;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // Drain what the plans owe the index now (plan-outbox.ts), as a plan's alarm would.
  flush: () => Promise<void>;
};

export function sqliteD1(base: Partial<Env> = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const planSql = nodeItemSql(sql);
  migratePlanSchema((q) => planSql.exec(q));
  // Test scaffolding for what the index holds in production (liveworkspace/docs/one-explorer.md): `test_plans`
  // writes a started plan's own row (what a create writes), and `test_share_links` holds the links the index
  // would grant through. `testGrantFor` (below) reads both, as the index's access rule does.
  sql.exec(`CREATE TEMP VIEW test_plans AS
    SELECT id, owner_id, name, team_id, source, saved_at, created_at, opens_in, tab_kind, template_family,
           0 AS shareable, NULL AS folder_id
      FROM plan`);
  sql.exec(`CREATE TEMP TRIGGER test_plans_insert INSTEAD OF INSERT ON test_plans
    BEGIN
      INSERT INTO plan (id, owner_id, name, team_id, source, saved_at, created_at, opens_in, tab_kind,
                        template_family)
      VALUES (NEW.id, NEW.owner_id, COALESCE(NEW.name, ''), NEW.team_id, NEW.source, COALESCE(NEW.saved_at, 0),
              MAX(COALESCE(NEW.created_at, 1), 1), NEW.opens_in, NEW.tab_kind, NEW.template_family)
      ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id, name = excluded.name,
        team_id = excluded.team_id, source = excluded.source, saved_at = excluded.saved_at,
        created_at = excluded.created_at;
    END`);
  sql.exec(`CREATE TEMP TABLE test_folders (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, team_id TEXT NULL, parent_id TEXT NULL, name TEXT NOT NULL)`);
  sql.exec(`CREATE TEMP TABLE test_share_links (
    code TEXT PRIMARY KEY, project_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'edit', level TEXT NULL,
    tab_id TEXT NULL, created_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NULL, expiry TEXT NULL)`);

  // One drain at a time, every plan with keys, until each is empty.
  let pushing: Promise<void> | null = null;
  const push = async (): Promise<void> => {
    while (pushing) await pushing;
    if (sql.prepare('SELECT 1 FROM outbox LIMIT 1').all().length === 0) return;
    pushing = (async () => {
      const { drainOutbox } = await import('./plan-room/plan-outbox');
      const plans = sql.prepare('SELECT DISTINCT plan_id FROM outbox').all() as {
        plan_id: string;
      }[];
      for (const { plan_id } of plans) {
        let more = true;
        while (more) more = (await drainOutbox(env, plan_id)).more;
      }
    })();
    try {
      await pushing;
    } finally {
      pushing = null;
    }
  };

  const planDb = new ItemDb(planSql, {
    transaction: nodeTransaction(sql),
    ensureSchema: () => {},
    onWrite: () => {},
  });
  const env = { ...base, PLAN_DB: planDb.asD1() } as unknown as PlanEnv;
  Object.defineProperty(env, TEST_GRANT_HOOK, {
    value: (planId: string, who: TestGrantCaller) => testGrantFor(sql, planId, who),
    enumerable: false,
  });
  Object.defineProperty(env, TEST_SQL, { value: sql, enumerable: false });
  // A test that sets env.PLAN_ROOM later (its relay recorder) gets it wrapped the same way.
  let rooms = testPlanRooms(env, sql, base.PLAN_ROOM);
  Object.defineProperty(env, 'PLAN_ROOM', {
    enumerable: true,
    get: () => rooms,
    set: (next: DurableObjectNamespace | undefined) => {
      rooms = testPlanRooms(env, sql, next);
    },
  });
  return { env, sql, flush: push };
}

const TEST_SQL = '__testSql';

// The index as a test's caller reaches it (index-service.ts `indexFor` and `requestGrant`, mocked with these): its
// grants by `testGrantFor`'s rule, and the folders in `test_folders` (a person's own, and their teams').
export function testIndexFor(env: unknown, caller: GrantCaller): IndexClient | null {
  const sql = (env as Record<string, unknown>)[TEST_SQL] as DatabaseSync | undefined;
  if (!sql) return null;
  const person = caller.kind === 'delegate' ? caller.personId : null;
  const teams = caller.kind === 'delegate' ? caller.teams : [];
  const client: Partial<IndexClient> = {
    grant: async (planId, share) => {
      const grant = testGrantFor(sql, planId, {
        person,
        teams,
        code: share?.code ?? null,
        create: false,
      });
      if (!grant) throw new IndexError(404, 'not_found');
      return {
        grant: grant.token,
        level: grant.level,
        tabId: grant.tab,
        expiresAt: grant.exp * 1000,
      };
    },
    listFolders: async () => {
      const rows = sql
        .prepare(
          `SELECT id, owner_id, team_id, parent_id, name FROM test_folders
            WHERE (team_id IS NULL AND owner_id = ?) OR team_id IN (SELECT value FROM json_each(?))`,
        )
        .all(person ?? '', JSON.stringify(teams)) as {
        id: string;
        owner_id: string;
        team_id: string | null;
        parent_id: string | null;
        name: string;
      }[];
      return {
        folders: rows.map((r) => ({
          id: r.id,
          ownerId: r.owner_id,
          teamId: r.team_id,
          parentId: r.parent_id,
          name: r.name,
          createdAt: 0,
          updatedAt: 0,
        })),
        nextCursor: null,
      };
    },
  };
  return client as IndexClient;
}

export async function testRequestGrant(
  env: Env,
  caller: GrantCaller,
  planId: string,
  share: ShareAccess | null,
): Promise<GrantOutcome> {
  const client = testIndexFor(env, caller);
  if (!client) return { ok: false, status: 503, error: 'index_unavailable' };
  try {
    return { ok: true, grant: await client.grant(planId, share) };
  } catch (err) {
    if (err instanceof IndexError) return { ok: false, status: err.status, error: err.code };
    throw err;
  }
}

// What the index would grant on a plan in a test (test-route-context.ts): the owner and a member of its team
// edit; a live `test_share_links` code grants its level, on its tab. A create (no started plan yet) is the
// caller's own. Null for anything else.
export const TEST_GRANT_HOOK = '__testGrant';

export type TestGrantCaller = {
  person: string | null;
  teams: readonly string[];
  code: string | null;
  create: boolean;
};

function testGrantFor(sql: DatabaseSync, planId: string, who: TestGrantCaller): PlanGrant | null {
  const plan = sql
    .prepare('SELECT owner_id, team_id, created_at FROM plan WHERE id = ?')
    .get(planId) as { owner_id: string; team_id: string | null; created_at: number } | undefined;
  const grant = (
    level: AccessLevel,
    tab: string | null,
    sub: string,
    code: string | null,
  ): PlanGrant => ({
    item: planId,
    level,
    tab,
    sub,
    team: plan?.team_id ?? null,
    exp: Math.floor(Date.now() / 1000) + 600,
    shareCode: code,
    token: `test-grant:${planId}:${sub}`,
  });
  if (!plan || !plan.created_at)
    return who.create && who.person ? grant('edit', null, who.person, null) : null;
  if (who.person && who.person === plan.owner_id) return grant('edit', null, who.person, null);
  if (who.person && plan.team_id && who.teams.includes(plan.team_id))
    return grant('edit', null, who.person, null);
  if (who.code) {
    const link = sql
      .prepare(
        'SELECT role, level, tab_id, expires_at FROM test_share_links WHERE code = ? AND project_id = ?',
      )
      .get(who.code, planId) as
      | { role: string; level: string | null; tab_id: string | null; expires_at: number | null }
      | undefined;
    if (link && (link.expires_at === null || link.expires_at > Date.now())) {
      const level = (link.level ?? link.role) as AccessLevel;
      return grant(level, link.tab_id, who.person ?? `link:${who.code}`, who.code);
    }
  }
  return null;
}

// The plan RPCs (plan-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// PLAN_ROOM (a recorder of relays), or answered 404 without one.
function testPlanRooms(
  env: PlanEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  type FakeId = DurableObjectId & { planName: string; roomId: unknown };
  const roomOf = (id: FakeId) =>
    rooms ? (rooms.get(id.roomId as DurableObjectId) as { fetch: typeof fetch }) : null;
  const ns = {
    idFromName: (name: string): FakeId => ({
      planName: name,
      roomId: rooms ? rooms.idFromName(name) : name,
      name,
      toString: () => name,
      equals: (other: DurableObjectId) => (other as FakeId).planName === name,
    }),
    get: (id: FakeId) => ({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const room = roomOf(id);
        return room
          ? room.fetch(input, init)
          : Promise.resolve(new Response(null, { status: 404 }));
      },
      outline: async (planId: string) =>
        (await import('./plan-room/plan-content')).readPlanOutline(env, planId),
      route: async (_planId: string, request: Request, identity: unknown) =>
        (await import('./plan-room/plan-route')).answerPlanRequest(
          env,
          request,
          identity as never,
          () => {},
        ),
      exportImage: async (
        planId: string,
        query: { tabId: string | null; ifVersion: number | null },
      ) => {
        const outline = await (
          await import('./plan-room/plan-content')
        ).readPlanOutline(env, planId);
        if (!outline.meta) return { status: 'not_found' };
        const version = outline.savedAt;
        if (query.ifVersion === version) return { status: 'unchanged', version };
        if (
          query.tabId !== null &&
          !(await (await import('./db/tabs')).planHasTab(env, planId, query.tabId))
        ) {
          return { status: 'not_found' };
        }
        const svg = await (
          await import('./thumbnail')
        ).drawPlan(
          env,
          { id: planId, name: outline.meta.name, itemTypes: outline.itemTypes },
          query.tabId,
        );
        return svg === null
          ? { status: 'empty', version }
          : { status: 'ok', body: svg, contentType: 'image/svg+xml; charset=utf-8', version };
      },
      hasTab: async (planId: string, tabId: string) =>
        (await import('./db/tabs')).planHasTab(env, planId, tabId),
      item: async (planId: string, itemId: string) =>
        (await import('./db/items')).readItem(env, planId, itemId),
      exportCopy: async (planId: string, onlyTabId: string | null, redact: string | null) =>
        (await import('./plan-room/plan-content')).exportPlanCopy(env, planId, onlyTabId, redact),
      joined: async (planId: string, personId: string) => {
        const meta = await (await import('./plan-room/plan-content')).readPlanMeta(env, planId);
        if (!meta) return;
        await (
          await import('./email/notifications')
        ).notifyProjectJoin(env, { id: planId, ownerId: meta.ownerId, name: meta.name }, personId);
      },
      importCopy: async (planId: string, copy: unknown) =>
        (await import('./plan-room/plan-content')).importPlanCopy(env, planId, copy as never),
      // Everything the plan stored goes, and the room hears it as it did (its `/purge`).
      purge: async (planId: string) => {
        sql.exec('SAVEPOINT purge');
        try {
          sql
            .prepare(
              `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM plan_tabs WHERE plan_id = ?)`,
            )
            .run(planId);
          sql.prepare('DELETE FROM plan WHERE id = ?').run(planId);
          sql.prepare('DELETE FROM outbox WHERE plan_id = ?').run(planId);
          sql.exec('RELEASE purge');
        } catch (err) {
          sql.exec('ROLLBACK TO purge');
          sql.exec('RELEASE purge');
          throw err;
        }
        const room = roomOf(id);
        if (room) {
          const res = await room.fetch('https://room/purge', { method: 'POST' });
          if (!res.ok) throw new Error(`status ${res.status}`);
        }
      },
      revokeCodes: async () => 0,
    }),
  };
  return ns as unknown as DurableObjectNamespace;
}

// A share link the index would grant through, for a test (as the index's createShareLink was called).
export function testShareLink(
  db: SqliteD1,
  projectId: string,
  code: string,
  role: AccessLevel,
  _expiry: string = 'never',
  tabId: string | null = null,
): void {
  db.sql
    .prepare(
      'INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES (?, ?, ?, ?, ?, 1)',
    )
    .run(code, projectId, role, role, tabId);
}

// A copy as the index makes one (its `copy-to` call, routes/internal-items.ts), then opened by its new owner, as
// copyProject did in one step: the source's content into the new plan, which starts as `owner`'s, named `name`.
export async function testCopyPlan(
  env: PlanEnv,
  sourceId: string,
  newId: string,
  owner: string,
  name: string,
  onlyTabId: string | null = null,
  redactAuthorsFor: string | null = null,
): Promise<import('./types').ProjectDTO | null> {
  const content = await import('./plan-room/plan-content');
  const copy = await content.exportPlanCopy(env, sourceId, onlyTabId, redactAuthorsFor);
  if (!copy) return null;
  await content.importPlanCopy(env, newId, copy);
  const now = Date.now();
  await content.initPlan(env, newId, {
    name,
    ownerId: owner,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt: now,
    createdAt: now,
  });
  return (await import('./db/projects')).getProject(env, newId);
}
