import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import type { SqliteD1 } from '../test-sqlite-d1';
import { box, call, documentWith, grantAt, stored } from './tab-save-test-kit';

// The ids a Viewer sees (docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work Tracker 1451): a Viewer
// reads names, never other people's account or guest ids, on the tab read and the comment list; Participants, Editors
// and the owner read every id; and a save made from a Viewer's copy never wipes one.

const ALICE = 'user_alice';
const BOB = 'guest_00000000-0000-4000-8000-00000000b0b0';

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

const people = (): Element[] => [
  { ...box('a'), action: action('x1', ALICE, BOB) } as unknown as Element,
  { ...box('b'), action: action('x2', BOB, ALICE) } as unknown as Element,
  {
    ...box('c'),
    commentThread: {
      resolved: false,
      comments: [
        {
          id: 'c1',
          text: 'over to @Alice',
          createdAt: 1,
          authorName: 'Bob',
          authorColor: '#000',
          authorId: BOB,
          mentions: [{ userId: ALICE, name: 'Alice' }],
        },
      ],
    },
  } as unknown as Element,
];

// The document with people in it, as stored (written under the create, which keeps only its creator's entries).
async function seeded(): Promise<SqliteD1> {
  const db = await documentWith([box('a'), box('b'), box('c')]);
  db.sql
    .prepare('UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = ?')
    .run(JSON.stringify({ id: 't1', name: 'Board', elements: people() }), 't1');
  return db;
}

const read = async (db: SqliteD1, who: 'owner' | 'view' | 'participate' | 'edit', as = ALICE) => {
  const res =
    who === 'owner'
      ? await call(db, 'GET', '/api/documents/D/tabs/t1')
      : await call(db, 'GET', '/api/documents/D/tabs/t1', {
          visitor: { owner: as, grant: grantAt(who) },
        });
  expect(res.status).toBe(200);
  return (await res.json<{ tab: { id: string; name: string; elements: Element[] } }>()).tab;
};

const actionOf = (els: Element[], id: string) =>
  (els.find((e) => e.id === id) as unknown as { action: ReturnType<typeof action> }).action;

afterEach(() => vi.restoreAllMocks());

describe('the tab read, by level', () => {
  it('hands a Viewer names, not ids, and keeps its own id so For You finds its actions', async () => {
    const db = await seeded();
    const tab = await read(db, 'view', ALICE);
    const text = JSON.stringify(tab);
    expect(text).not.toContain(BOB);
    // Alice's own assignment keeps her id; the assigner she did not name reads hidden.
    expect(actionOf(tab.elements, 'a').assignee).toEqual({ userId: ALICE, name: 'Alice' });
    expect(actionOf(tab.elements, 'a').assignerId).toBe('hidden');
    expect(actionOf(tab.elements, 'a').assignerName).toBe('Bob');
    expect(actionOf(tab.elements, 'b').assignee.userId).toBe('hidden');
    expect(actionOf(tab.elements, 'b').assignee.name).toBe('Alice');
  });

  it('hides every id from a Viewer who is somebody else', async () => {
    const db = await seeded();
    const text = JSON.stringify(await read(db, 'view', 'user_carol'));
    expect(text).not.toContain(ALICE);
    expect(text).not.toContain(BOB);
  });

  it.each(['participate', 'edit'] as const)('hands a %s every id', async (level) => {
    const db = await seeded();
    const tab = await read(db, level, 'user_carol');
    expect(actionOf(tab.elements, 'a').assignerId).toBe(BOB);
    expect(actionOf(tab.elements, 'b').assignee.userId).toBe(BOB);
  });

  it('hands the owner every id', async () => {
    const db = await seeded();
    const tab = await read(db, 'owner');
    expect(actionOf(tab.elements, 'a').assignee.userId).toBe(ALICE);
    expect(actionOf(tab.elements, 'b').assignerId).toBe(ALICE);
  });
});

describe('the comment list, by level', () => {
  const list = async (db: SqliteD1, level: 'view' | 'participate') => {
    const res = await call(db, 'GET', '/api/documents/D/comments', {
      visitor: { owner: 'user_carol', grant: grantAt(level) },
    });
    expect(res.status).toBe(200);
    return JSON.stringify(await res.json());
  };

  it('names who was mentioned to a Viewer without their id, and with it to a Participant', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await seeded();
    const seen = await list(db, 'view');
    expect(seen).toContain('Alice');
    expect(seen).not.toContain(ALICE);
    expect(await list(db, 'participate')).toContain(ALICE);
  });
});

describe('a save made from a Viewer copy', () => {
  // The data-loss guard: the copy a Viewer read, saved whole by an Editor (a link raised while the editor was open),
  // stores every id as it was.
  it('never wipes an id', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await seeded();
    const copy = await read(db, 'view', 'user_carol');
    expect(JSON.stringify(copy)).toContain('hidden');
    const renamed = copy.elements.map((e) => (e.id === 'b' ? { ...e, label: 'Renamed' } : e));
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { ...copy, elements: renamed },
      visitor: { owner: 'user_carol', grant: grantAt('edit') },
    });
    expect(res.status).toBe(200);
    const after = stored(db);
    expect(actionOf(after, 'a')).toEqual(action('x1', ALICE, BOB));
    expect(actionOf(after, 'b')).toEqual(action('x2', BOB, ALICE));
    expect((after.find((e) => e.id === 'b') as { label?: string }).label).toBe('Renamed');
    const mention = (
      after.find((e) => e.id === 'c') as unknown as {
        commentThread: { comments: { mentions: { userId: string }[] }[] };
      }
    ).commentThread.comments[0]!.mentions[0]!;
    expect(mention.userId).toBe(ALICE);
    expect(JSON.stringify(after)).not.toContain('hidden');
  });

  it('stores what the owner saves as it was', async () => {
    const db = await seeded();
    const res = await call(db, 'PUT', '/api/documents/D/tabs/t1', {
      body: { id: 't1', name: 'Board', elements: people() },
    });
    expect(res.status).toBe(200);
    expect(actionOf(stored(db), 'a').assignee.userId).toBe(ALICE);
  });
});
