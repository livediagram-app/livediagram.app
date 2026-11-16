import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { personStore } from '../person-client';
import { handleInternalShapeLibraries } from './internal-shape-libraries';

// The internal door the Library reads livehuddle's shape libraries through
// (liveworkspace/docs/specs/006-media/libraries.md "The old shape libraries, read in place"): an account's libraries,
// each shape drawn, to the media key only; nothing in the store changes.

let db: SqliteD1;
beforeEach(() => {
  db = sqliteD1();
  db.env.MEDIA_KEY = 'lh-media-key';
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const ask = (auth: string | null, owner = 'user_ada') =>
  handleInternalShapeLibraries(
    new Request(`https://api.test/api/internal/shape-libraries?owner=${owner}`, {
      headers: auth ? { Authorization: auth } : {},
    }),
    db.env,
  );

const BOX = { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 80, height: 40 };

describe('/api/internal/shape-libraries', () => {
  it('answers an account’s shape libraries, drawn, to the media key only', async () => {
    await personStore(db.env, 'user_ada').createShapeLibrary(
      {
        id: 'L1',
        name: 'AWS',
        source: 'drawio',
        items: [{ id: 'i1', title: 'Box', width: 80, height: 40, elements: [BOX] }],
      } as never,
      100,
    );
    const res = await ask('Bearer lh-media-key');
    expect(res.status).toBe(200);
    const body = await res.json<{
      libraries: { name: string; previews: Record<string, string> }[];
    }>();
    expect(body.libraries.map((l) => l.name)).toEqual(['AWS']);
    expect(body.libraries[0]!.previews.i1).toContain('<svg');
    expect((await ask(null)).status).toBe(401);
    expect((await ask('Bearer wrong')).status).toBe(401);
    expect((await ask('Bearer lh-media-key', 'guest:x')).status).toBe(400);
  });
});
