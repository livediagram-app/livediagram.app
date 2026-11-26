import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { ItemGrant } from '../index-service';
import * as db from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The ids a Viewer sees (docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work Tracker 1451): a Viewer
// reads names, never other people's account or guest ids, on the tab read and the comment list; Participants, Editors
// and the owner read every id; and a save made from a Viewer's copy never wipes one.

const OWNER = 'user_owner';
const ALICE = 'user_alice';
const BOB = 'guest_00000000-0000-4000-8000-00000000b0b0';
const BASE = '/api/documents/d1';

type El = Record<string, unknown> & { id: string };
type Action = {
  id: string;
  assignee: { userId: string | null; name: string | null };
  assignerId: string;
  assignerName: string | null;
};

const box = (id: string, extra: Record<string, unknown> = {}): El => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  label: id,
  ...extra,
});

const action = (id: string, assignee: string, assigner: string) => ({
  id,
  name: `Ship ${id}`,
  description: '',
  assignee: { userId: assignee, name: 'Alice' },
  teamId: null,
  assignerId: assigner,
  assignerName: 'Bob',
  status: 'open',
  createdAt: 1,
  updatedAt: 1,
});

const people = (): El[] => [
  box('a', { action: action('x1', ALICE, BOB) }),
  box('b', { action: action('x2', BOB, ALICE) }),
  box('c', {
    commentThread: {
      resolved: false,
      comments: [
        {
          id: 'c1',
          text: 'over to @Alice',
          createdAt: 1,
          authorName: 'Bob',
          authorColor: '#000000',
          authorId: BOB,
          mentions: [{ userId: ALICE, name: 'Alice' }],
        },
      ],
    },
  }),
];

let sql: SqliteD1;

beforeEach(() => {
  sql = sqliteD1();
  sql.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, shareable, saved_at, created_at)
      VALUES ('d1', 'user_owner', 'Payments', 1, 1, 1);
    INSERT INTO tabs (id, name, data, updated_at, element_count) VALUES ('t1', 'Main', '{"elements":[]}', 1, 0);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
  sql.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ elements: people() }), 't1');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

type Level = ItemGrant['level'];
const grantAt = (level: Level): ItemGrant => ({
  item: 'd1',
  level,
  tab: null,
  sub: 'link:abc',
  team: null,
  exp: 2_000_000_000,
  shareCode: 'abc',
  token: 'g',
});

function call(method: string, path: string, who: Level | 'owner', as = ALICE, body?: unknown) {
  return handleDocuments(
    makeTestRouteContext(method, `${BASE}${path}`, {
      env: sql.env,
      owner: who === 'owner' ? OWNER : as,
      ...(who === 'owner' ? {} : { grant: grantAt(who) }),
      ...(body === undefined ? {} : { body }),
    }),
  );
}

const read = async (who: Level | 'owner', as = ALICE) => {
  const res = await call('GET', '/tabs/t1', who, as);
  expect(res.status).toBe(200);
  return ((await res.json()) as { tab: { id: string; name: string; elements: El[] } }).tab;
};
const stored = async () => (await db.getTab(sql.env, 'd1', 't1'))!.elements as unknown as El[];
const actionOf = (els: El[], id: string) => els.find((e) => e.id === id)!.action as Action;

describe('the tab read, by level', () => {
  it('hands a Viewer names, not ids, and keeps its own id so For You finds its actions', async () => {
    const tab = await read('view', ALICE);
    expect(JSON.stringify(tab)).not.toContain(BOB);
    expect(actionOf(tab.elements, 'a').assignee).toEqual({ userId: ALICE, name: 'Alice' });
    expect(actionOf(tab.elements, 'a').assignerId).toBe('hidden');
    expect(actionOf(tab.elements, 'a').assignerName).toBe('Bob');
    expect(actionOf(tab.elements, 'b').assignee.userId).toBe('hidden');
    expect(actionOf(tab.elements, 'b').assignee.name).toBe('Alice');
  });

  it('hides every id from a Viewer who is somebody else', async () => {
    const text = JSON.stringify(await read('view', 'user_carol'));
    expect(text).not.toContain(ALICE);
    expect(text).not.toContain(BOB);
  });

  it.each(['participate', 'edit'] as const)('hands a %s every id', async (level) => {
    const tab = await read(level, 'user_carol');
    expect(actionOf(tab.elements, 'a').assignerId).toBe(BOB);
    expect(actionOf(tab.elements, 'b').assignee.userId).toBe(BOB);
  });

  it('hands the owner every id', async () => {
    const tab = await read('owner');
    expect(actionOf(tab.elements, 'a').assignee.userId).toBe(ALICE);
    expect(actionOf(tab.elements, 'b').assignerId).toBe(ALICE);
  });
});

describe('the comment list, by level', () => {
  const list = async (level: Level) => {
    const res = await call('GET', '/comments', level, 'user_carol');
    expect(res.status).toBe(200);
    return JSON.stringify(await res.json());
  };

  it('names who was mentioned to a Viewer without their id, and with it to a Participant', async () => {
    const seen = await list('view');
    expect(seen).toContain('Alice');
    expect(seen).not.toContain(ALICE);
    expect(await list('participate')).toContain(ALICE);
  });
});

describe('a save made from a Viewer copy', () => {
  // The data-loss guard: the copy a Viewer read, saved whole by an Editor (a link raised while the editor was open),
  // stores every id as it was.
  it('never wipes an id', async () => {
    const copy = await read('view', 'user_carol');
    expect(JSON.stringify(copy)).toContain('hidden');
    const renamed = copy.elements.map((e) => (e.id === 'b' ? { ...e, label: 'Renamed' } : e));
    const res = await call('PUT', '/tabs/t1', 'edit', 'user_carol', { ...copy, elements: renamed });
    expect(res.status).toBe(200);
    const after = await stored();
    expect(actionOf(after, 'a')).toEqual(action('x1', ALICE, BOB));
    expect(actionOf(after, 'b')).toEqual(action('x2', BOB, ALICE));
    expect(after.find((e) => e.id === 'b')!.label).toBe('Renamed');
    const thread = after.find((e) => e.id === 'c')!.commentThread as {
      comments: { mentions: { userId: string }[] }[];
    };
    expect(thread.comments[0]!.mentions[0]!.userId).toBe(ALICE);
    expect(JSON.stringify(after)).not.toContain('hidden');
  });

  it('stores what the owner saves as it was', async () => {
    const res = await call('PUT', '/tabs/t1', 'owner', OWNER, {
      id: 't1',
      name: 'Main',
      elements: people(),
    });
    expect(res.status).toBe(200);
    expect(actionOf(await stored(), 'a').assignee.userId).toBe(ALICE);
  });
});
