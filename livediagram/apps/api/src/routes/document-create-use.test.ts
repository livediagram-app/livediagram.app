import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getDocument } from '../db';
import { asUser, makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// A create's markUsed (docs/specs/015-api/api.md "Marking a document used"): absent or a boolean is taken; anything
// else refuses the create before anything is written. Which makings count as uses is the index's (its Home).

let db: SqliteD1;
let logs: string[];

function create(id: string, extra: Record<string, unknown> = {}): Promise<Response> {
  return handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      ...asUser('user_me'),
      body: {
        id,
        name: `Doc ${id}`,
        tabs: [{ id: `${id}-t1`, name: 'Tab 1', elements: [] }],
        ...extra,
      },
    }),
  );
}

beforeEach(() => {
  db = sqliteD1();
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('making a document', () => {
  it('takes a boolean markUsed', async () => {
    expect((await create('d1', { markUsed: false })).status).toBe(201);
    expect((await create('d2', { markUsed: true })).status).toBe(201);
    expect((await create('d3')).status).toBe(201);
  });

  it('refuses a markUsed that is not a boolean, creating nothing', async () => {
    const res = await create('d1', { markUsed: 'false' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid markUsed' });
    expect(await getDocument(db.env, 'd1')).toBeNull();
    expect(logs).toContain('documents: rejected reason=mark_used_invalid');
  });
});
