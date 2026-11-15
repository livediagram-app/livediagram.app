import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { Element } from '@liveplanner/project';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// A flow chart's settings end to end, by role (docs/specs/026-plan/plan-agents.md "Making a dashboard" "Roles",
// plan-views.md "Flow charts" "Who sees what"): only an Editor (the owner, an edit link, an edit link scoped to the
// chart's tab, the owner's agent) changes a chart's Range or Card Types, through a changeset (the agents' door) or a
// save (the editor's); a Participant and a Viewer are refused and nothing changes; every role reads the flow, and a
// tab-scoped link reads it on its tab.

let db: SqliteD1;

const chart = (id: string, planView: Record<string, unknown>): Element =>
  ({
    id,
    type: 'shape',
    shape: 'plan-view',
    x: 0,
    y: 0,
    width: 600,
    height: 360,
    planView,
  }) as Element;

type Who = { owner?: string; code?: string; agent?: boolean };

function call(method: string, path: string, body?: unknown, who: Who = {}) {
  const owner = who.owner ?? 'owner';
  return handleProjects(
    makeTestRouteContext(method, `/api/projects/p1${path}`, {
      env: db.env,
      owner,
      accountUserId: who.agent || who.code ? null : owner,
      verifiedUserId: who.code ? null : owner,
      ...(who.code ? { headers: { 'X-Share-Code': who.code } } : {}),
      ...(who.agent ? { token: { id: 'tok_1' } } : {}),
      ...(body === undefined ? {} : { body }),
      waitUntil: () => undefined,
    }),
  );
}

// One changeset setting a chart's range, as update_project and the CLI send it.
const setRange = (tab: string, id: string, rangeDays: number, who: Who) =>
  call(
    'POST',
    `/tabs/${tab}/changesets`,
    {
      operations: [
        { op: 'set', target: id, fields: { planView: { view: 'throughput', rangeDays } } },
      ],
    },
    who,
  );

const storedView = (tab: string) =>
  (
    JSON.parse(db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab)!.data as string) as {
      elements: Element[];
    }
  ).elements.map((el) => (el as { planView?: unknown }).planView);

const EDITOR: Who = { owner: 'visitor', code: 'EDIT' };
const PARTICIPANT: Who = { owner: 'visitor', code: 'PART' };
const VIEWER: Who = { owner: 'visitor', code: 'LOOK' };
const TAB_EDITOR: Who = { owner: 'visitor', code: 'TAB1' };

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  db = sqliteD1();
  (db.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (input: string) =>
        input.includes('/selections')
          ? Response.json({ selections: [] })
          : new Response(null, { status: 204 }),
    }),
  };
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('visitor', 'Vee', '#16a34a');
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('p1', 'owner', 'Plan', 1, 1, 1)`);
  for (const [i, tab] of ['t1', 't2'].entries()) {
    db.sql
      .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)`)
      .run(
        tab,
        `Flow ${i}`,
        JSON.stringify({ elements: [chart(`v${i + 1}`, { view: 'throughput' })] }),
      );
    db.sql
      .prepare(
        `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('p1', ?, ?, 1)`,
      )
      .run(tab, i);
  }
  testShareLink(db, 'p1', 'EDIT', 'edit');
  testShareLink(db, 'p1', 'PART', 'participate');
  testShareLink(db, 'p1', 'LOOK', 'view');
  testShareLink(db, 'p1', 'TAB1', 'edit', 'never', 't1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("changing a flow chart's settings", () => {
  it('lets the owner, an edit link and the owner’s agent change the range', async () => {
    for (const [who, rangeDays] of [
      [{}, 14],
      [EDITOR, 90],
      [{ agent: true }, 180],
    ] as const) {
      const res = await setRange('t1', 'v1', rangeDays, who);
      expect(res.status, JSON.stringify(who)).toBe(200);
      expect(storedView('t1')).toEqual([{ view: 'throughput', rangeDays }]);
    }
  });

  it('lets a link scoped to the chart’s tab change it there, and finds no chart on another tab', async () => {
    expect((await setRange('t1', 'v1', 90, TAB_EDITOR)).status).toBe(200);
    expect(storedView('t1')).toEqual([{ view: 'throughput', rangeDays: 90 }]);
    expect((await setRange('t2', 'v2', 90, TAB_EDITOR)).status).toBe(404);
    expect(storedView('t2')).toEqual([{ view: 'throughput' }]);
  });

  it('refuses a Participant and a Viewer, by changeset and by save, and changes nothing', async () => {
    for (const who of [PARTICIPANT, VIEWER]) {
      expect((await setRange('t1', 'v1', 90, who)).status).toBe(403);
      const save = await call(
        'PUT',
        '/tabs/t1',
        { name: 'Flow 0', elements: [chart('v1', { view: 'throughput', rangeDays: 90 })] },
        who,
      );
      expect(save.status).toBe(403);
    }
    expect(storedView('t1')).toEqual([{ view: 'throughput' }]);
  });

  it('refuses a range outside the four, for an Editor too, and changes nothing', async () => {
    const res = await setRange('t1', 'v1', 7, {});
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toContain('rangeDays (14, 30, 90 or 180)');
    expect(storedView('t1')).toEqual([{ view: 'throughput' }]);
  });
});

describe('reading the flow', () => {
  it('answers every role, and a tab-scoped link on its tab', async () => {
    for (const who of [{}, EDITOR, PARTICIPANT, VIEWER, { agent: true }])
      expect((await call('GET', '/flow?days=90', undefined, who)).status, JSON.stringify(who)).toBe(
        200,
      );
    expect((await call('GET', '/flow?days=90&tabId=t1', undefined, TAB_EDITOR)).status).toBe(200);
  });
});
