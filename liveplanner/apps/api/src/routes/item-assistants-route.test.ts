import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../person/profiles', () => import('../test-profiles'));
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import type { ItemAssistantsResponse } from '@liveplanner/api-schema';
import { itemAssistantFor, itemPersonId, presetSetup } from '@liveplanner/items';
import {
  KNOWN_ASSISTANTS_MAX,
  KNOWN_ASSISTANT_REFRESH_MS,
  knownAssistants,
  rememberAssistant,
} from '../plan-room/known-assistants';
import { anonymisePlan } from '../plan-room/plan-anonymise';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { noteAssistant } from './item-assistants-route';

// docs/specs/026-plan/items.md "Who it can be handed to" (blueprint item-store.md "Assistants the plan remembers"): a
// token reaching the plan's cards as an Editor or a Participant is remembered, never a Viewer's, a read-only token, a
// nameless one or a session; the editor reads them back; a closed account's are forgotten.

let sql: SqliteD1;
const env = () => sql.env;

type Token = { id: string; name?: string | null; readOnly?: boolean };

async function call<T = unknown>(opts: {
  method?: string;
  path: string;
  owner?: string;
  code?: string;
  token?: Token | null;
}) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(opts.method ?? 'GET', `/api/projects/d1${opts.path}`, {
    env: sql.env,
    owner: opts.owner ?? 'owner',
    ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
    ...(opts.token ? { token: opts.token } : {}),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleProjects(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

const CLAUDE_TOKEN: Token = { id: 'tok_1', name: 'Claude' };
const EDIT = { owner: 'e', code: 'EDIT' };
const PART = { owner: 'p', code: 'PART' };
const VIEW = { owner: 'v', code: 'VIEW' };

const remembered = async (as: { owner?: string; code?: string } = {}) =>
  (await call<ItemAssistantsResponse>({ ...as, path: '/items/assistants' })).body.assistants;

beforeEach(() => {
  sql = sqliteD1();
  (sql.env as unknown as { PLAN_ROOM: unknown }).PLAN_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
  };
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('kanban'),
  };
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'owner', 'Plan', 1, 1, 1);
  `);
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', ?, 1)`)
    .run(JSON.stringify({ elements: [board] }));
  sql.sql.exec(`
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB', 'd1', 'edit', 't1', 1);
  `);
  clearTestProfiles();
  setTestProfile('owner', 'Webber', '#3b82f6');
  setTestProfile('e', 'Erin Moss', '#16a34a');
  setTestProfile('p', 'Pat Lee', '#d97706');
  setTestProfile('v', 'Val Kim', '#dc2626');
});

describe('the AI assistants a plan remembers', () => {
  it('remembers the token of an Editor and a Participant listing the cards, by tool and person', async () => {
    expect(await remembered()).toEqual([]);
    for (const as of [EDIT, PART])
      expect((await call({ ...as, path: '/items', token: CLAUDE_TOKEN })).status).toBe(200);
    const pat = { id: await itemPersonId('p'), name: 'Pat Lee', color: '#d97706' };
    const erin = { id: await itemPersonId('e'), name: 'Erin Moss', color: '#16a34a' };
    expect(await remembered()).toEqual([
      itemAssistantFor(pat, 'Claude'),
      itemAssistantFor(erin, 'Claude'),
    ]);
  });

  it('remembers nobody for a Viewer’s token, a read-only or nameless token, or a session', async () => {
    await call({ ...VIEW, path: '/items', token: CLAUDE_TOKEN });
    await call({ ...EDIT, path: '/items', token: { id: 't2', name: 'Cursor', readOnly: true } });
    await call({ ...EDIT, path: '/items', token: { id: 't3', name: null } });
    await call({ ...EDIT, path: '/items', token: { id: 't4', name: '   ' } });
    await call({ ...EDIT, path: '/items' });
    expect(await remembered()).toEqual([]);
  });

  it('writes one assistant at most once an hour', async () => {
    await call({ ...PART, path: '/items', token: CLAUDE_TOKEN });
    setTestProfile('p', 'Patricia Lee', '#d97706');
    await call({ ...PART, path: '/items', token: CLAUDE_TOKEN });
    expect((await remembered()).map((a) => a.name)).toEqual(['Claude (Pat)']);
    // An hour on, the next reach refreshes its person.
    sql.sql.exec(`UPDATE known_assistants SET seen_at = seen_at - ${KNOWN_ASSISTANT_REFRESH_MS}`);
    await call({ ...PART, path: '/items', token: CLAUDE_TOKEN });
    expect((await remembered()).map((a) => a.name)).toEqual(['Claude (Patricia)']);
  });

  it('keeps the newest KNOWN_ASSISTANTS_MAX, and skips a row that does not read as one', async () => {
    for (let n = 0; n <= KNOWN_ASSISTANTS_MAX; n++) {
      const person = { id: n.toString(16).padStart(24, '0'), name: `P${n}`, color: '#2563eb' };
      await rememberAssistant(env(), itemAssistantFor(person, 'Claude')!, n);
    }
    const kept = await knownAssistants(env());
    expect(kept).toHaveLength(KNOWN_ASSISTANTS_MAX);
    expect(kept[0]!.name).toBe(`Claude (P${KNOWN_ASSISTANTS_MAX})`);
    expect(kept.some((a) => a.name === 'Claude (P0)')).toBe(false);
    sql.sql.exec(
      `INSERT INTO known_assistants (id, client, person_id, person, seen_at) VALUES
         ('ai-x', 'Claude', 'x', 'not json', 999), ('ai-y', 'Claude', 'y', '{"id":"y"}', 999)`,
    );
    expect(await knownAssistants(env())).toHaveLength(KNOWN_ASSISTANTS_MAX);
  });

  it('answers a Viewer the list, a tab-scoped link none, and refuses a write to it', async () => {
    await call({ ...PART, path: '/items', token: CLAUDE_TOKEN });
    expect(await remembered(VIEW)).toHaveLength(1);
    const scoped = await call<ItemAssistantsResponse>({
      owner: 't',
      code: 'TAB',
      path: '/items/assistants?tabId=t1',
    });
    expect(scoped.status).toBe(200);
    expect(scoped.body.assistants).toEqual([]);
    expect((await call({ method: 'POST', path: '/items/assistants' })).status).toBe(405);
  });

  it('forgets a closed account’s assistants', async () => {
    await call({ ...PART, path: '/items', token: CLAUDE_TOKEN });
    await call({ ...EDIT, path: '/items', token: CLAUDE_TOKEN });
    await anonymisePlan(env(), 'd1', 'p');
    expect((await remembered()).map((a) => a.name)).toEqual(['Claude (Erin)']);
  });

  it('remembers nobody for a token named past a tool name, or a person the store refuses', async () => {
    await call({ ...EDIT, path: '/items', token: { id: 't5', name: 'C'.repeat(41) } });
    const ctx = makeTestRouteContext('GET', '/api/projects/d1/items', {
      env: sql.env,
      owner: 'p',
      token: CLAUDE_TOKEN,
    });
    await noteAssistant(ctx, { projectId: 'd1', owner: 'p' }, 'edit', async () => ({
      id: 'not-a-person',
      name: 'Pat',
      color: '#d97706',
    }));
    expect(await remembered()).toEqual([]);
  });

  it('never fails the answer when noting goes wrong', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = makeTestRouteContext('GET', '/api/projects/d1/items', {
      env: sql.env,
      owner: 'p',
      token: CLAUDE_TOKEN,
    });
    await noteAssistant(ctx, { projectId: 'd1', owner: 'p' }, 'edit', () =>
      Promise.reject(new Error('profiles down')),
    );
    expect(warn).toHaveBeenCalledWith('[items] assistant.note-failed', expect.anything());
    warn.mockRestore();
  });
});
