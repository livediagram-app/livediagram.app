import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// docs/specs/015-api/api.md "Document dates": an imported board keeps its own created and
// last-modified dates through the whole create, seeded tabs included, against a real schema.
const createdAt = Date.UTC(2020, 7, 14);
const savedAt = Date.UTC(2021, 1, 3);

describe('POST /documents with its own dates', () => {
  it('stores them, and seeding its tabs leaves the modified date as given', async () => {
    const db = sqliteD1();
    const res = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents', {
        env: db.env,
        owner: 'owner',
        body: {
          id: 'd1',
          name: 'Whiteboard, 14 Aug 2020',
          createdAt,
          savedAt,
          tabs: [{ id: 't1', name: 'Whiteboard', kind: 'whiteboard', elements: [] }],
        },
      }),
    );
    expect(res.status).toBe(201);
    const row = db.sql.prepare('SELECT created_at, saved_at FROM documents WHERE id = ?').get('d1');
    expect(row).toEqual({ created_at: createdAt, saved_at: savedAt });
  });

  it('stamps an ordinary create now', async () => {
    const db = sqliteD1();
    const before = Date.now();
    await handleDocuments(
      makeTestRouteContext('POST', '/api/documents', {
        env: db.env,
        owner: 'owner',
        body: { id: 'd2', name: 'Doc', tabs: [{ id: 't2', name: 'Tab 1', elements: [] }] },
      }),
    );
    const row = db.sql
      .prepare('SELECT created_at, saved_at FROM documents WHERE id = ?')
      .get('d2') as {
      created_at: number;
      saved_at: number;
    };
    expect(row.created_at).toBeGreaterThanOrEqual(before);
    expect(row.saved_at).toBeGreaterThanOrEqual(before);
  });
});
