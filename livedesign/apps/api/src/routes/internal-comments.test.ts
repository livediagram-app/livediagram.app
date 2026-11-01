// The data export's door into a design (liveworkspace/docs/specs/003-accounts/data-export.md "The apps' doors";
// docs/specs/015-api/api.md "Internal"): every comment thread, with each comment's real author, on DATA_EXPORT_KEY.
import { describe, expect, it, vi } from 'vitest';
import type { Comment, Element } from '@livedesign/design';
import { ANONYMISED_PERSON, type ExportThread } from '@liveworkspace/index-app';
import { upsertTab } from '../db/tabs';
import { exportThreadsOfTab } from '../design-room/design-comments';
import { sqliteD1 } from '../test-sqlite-d1';
import { handleInternalItems } from './internal-items';

const DATA_EXPORT_KEY = 'data-export-key';
const OWNER = 'user_ada';
const BOB = 'user_bob';

const comment = (id: string, authorId: string | undefined, createdAt: number): Comment => ({
  id,
  text: `said ${id}`,
  createdAt,
  authorName: id === 'c0' ? '' : `name ${id}`,
  authorColor: '#000',
  ...(authorId ? { authorId } : {}),
});

const box = (id: string, comments?: Comment[], resolved = false): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...(comments ? { commentThread: { comments, resolved } } : {}),
  }) as unknown as Element;

async function arrange() {
  const db = sqliteD1({
    INDEX_KEY: 'index-key',
    DRIVE_KEY: 'drive-key',
    MEDIA_KEY: 'media-key',
    DATA_EXPORT_KEY,
  });
  const send = (path: string, key = DATA_EXPORT_KEY) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        headers: { Authorization: `Bearer ${key}` },
      }),
      db.env,
    );
  // Ada's design A: a thread with a reply on the first tab, written out of order; a resolved thread and an element
  // with none on the second; a third tab with no comments at all.
  db.sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 1, 1)',
    )
    .run('A', OWNER, 'Logo');
  await upsertTab(
    db.env,
    'A',
    {
      id: 't1',
      name: 'One',
      elements: [box('a', [comment('c2', BOB, 20), comment('c1', OWNER, 10)])],
    },
    0,
  );
  await upsertTab(
    db.env,
    'A',
    {
      id: 't2',
      name: 'Two',
      elements: [box('plain'), box('b', [comment('c3', BOB, 30)], true)],
    },
    1,
  );
  await upsertTab(db.env, 'A', { id: 't3', name: 'Three', elements: [box('c')] }, 2);
  return { db, send };
}

const threads = async (res: Response) => (await res.json<{ threads: ExportThread[] }>()).threads;

describe('GET /api/internal/items/:id/export?format=comments', () => {
  it('answers every thread, tabs in order and comments oldest first, with their real authors', async () => {
    const { send } = await arrange();
    const res = await send('A/export?format=comments');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await threads(res)).toEqual([
      {
        id: 't1:a',
        tabId: 't1',
        tabName: 'One',
        on: 'a',
        resolved: false,
        comments: [
          { id: 'c1', authorId: OWNER, authorName: 'name c1', text: 'said c1', createdAt: 10 },
          { id: 'c2', authorId: BOB, authorName: 'name c2', text: 'said c2', createdAt: 20 },
        ],
      },
      {
        id: 't2:b',
        tabId: 't2',
        tabName: 'Two',
        on: 'b',
        resolved: true,
        comments: [
          { id: 'c3', authorId: BOB, authorName: 'name c3', text: 'said c3', createdAt: 30 },
        ],
      },
    ]);
  });

  it("opens on the index's key too, and on no other", async () => {
    const { send } = await arrange();
    expect((await send('A/export?format=comments', 'index-key')).status).toBe(200);
    expect((await send('A/export?format=comments', 'drive-key')).status).toBe(401);
    expect((await send('A/export?format=comments', 'media-key')).status).toBe(401);
    // The data export's key opens the export door alone.
    const purge = await handleInternalItems(
      new Request('https://api.test/api/internal/items/A', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${DATA_EXPORT_KEY}` },
      }),
      (await arrange()).db.env,
    );
    expect(purge.status).toBe(401);
  });

  it('is a 404 for no design, and for the csv format a design has no tables for', async () => {
    const { send } = await arrange();
    expect((await send('Z/export?format=comments')).status).toBe(404);
    expect((await send('A/export?format=csv')).status).toBe(404);
  });

  it('leaves out a tab whose body does not parse, or holds no elements', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db, send } = await arrange();
    db.sql
      .prepare(`UPDATE tabs SET data = '{"commentThread": ', rev = rev + 1 WHERE id = 't1'`)
      .run();
    db.sql
      .prepare(`UPDATE tabs SET data = '{"commentThread": {}}', rev = rev + 1 WHERE id = 't2'`)
      .run();
    const res = await send('A/export?format=comments');
    expect(res.status).toBe(200);
    expect(await threads(res)).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[export] comments skipped tab', expect.anything());
    warn.mockRestore();
  });

  it('opens the svg and file formats on the data export key as well', async () => {
    const { send } = await arrange();
    expect((await send('A/export?format=file')).status).toBe(200);
  });
});

describe('exportThreadsOfTab', () => {
  it('skips an emptied thread, and answers no author for one never recorded or taken off', () => {
    const tab = {
      id: 't',
      name: 'Tab',
      elements: [
        box('empty', []),
        box('x', [comment('c0', undefined, 5), comment('gone', ANONYMISED_PERSON, 6)]),
      ],
    };
    expect(exportThreadsOfTab(tab)).toEqual([
      {
        id: 't:x',
        tabId: 't',
        tabName: 'Tab',
        on: 'x',
        resolved: false,
        comments: [
          { id: 'c0', authorId: null, authorName: null, text: 'said c0', createdAt: 5 },
          { id: 'gone', authorId: null, authorName: 'name gone', text: 'said gone', createdAt: 6 },
        ],
      },
    ]);
  });
});
