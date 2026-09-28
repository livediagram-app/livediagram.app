import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { countUnseen, readTimeline } from './timeline';

// Renames are not timeline moments (docs/specs/013-workspace/timeline.md §4.2): every entry names its
// diagram as it is called NOW, and the rename events written before that
// change stay out of the feed and the unread count.

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const scope = { scopeType: 'user' as const, scopeId: 'owner' };

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function diagram(sql: DatabaseSync, id: string, name: string) {
  insert(sql, 'diagrams', {
    id,
    owner_id: 'owner',
    name,
    shareable: 1,
    saved_at: T0,
    created_at: T0,
  });
}

function event(
  sql: DatabaseSync,
  id: string,
  type: string,
  snapshot: Record<string, string>,
  at: number,
  sourceId = snapshot.diagramId ?? 'x',
) {
  insert(sql, 'timeline_events', {
    id,
    actor_id: 'someone',
    source_type: 'diagram',
    source_id: sourceId,
    event_type: type,
    title: type,
    occurred_at: at,
    snapshot: JSON.stringify(snapshot),
    created_at: T0,
  });
  insert(sql, 'timeline_event_scopes', {
    event_id: id,
    scope_type: 'user',
    scope_id: 'owner',
    added_at: T0,
  });
}

describe('Timeline names', () => {
  it('shows a diagram by its current name on entries from before a rename', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'd1', 'Payments v2');
    event(sql, 'created', 'diagram_created', { diagramId: 'd1', diagramName: 'Payments' }, T0 + 1);
    // A comment's source is its thread; the diagram is found through the snapshot.
    event(
      sql,
      'comment',
      'comment_added',
      { diagramId: 'd1', diagramName: 'Payments' },
      T0 + 2,
      'thread-1',
    );

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items.map((e) => e.snapshot.diagramName)).toEqual(['Payments v2', 'Payments v2']);
  });

  it('keeps the saved name for a diagram that no longer exists', async () => {
    const { env, sql } = sqliteD1();
    event(sql, 'gone', 'diagram_deleted', { diagramName: 'Old board' }, T0 + 1, 'deleted-id');
    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items[0]?.snapshot.diagramName).toBe('Old board');
  });

  it('leaves rename events out of the feed and the unread count', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'd1', 'Payments v2');
    event(sql, 'created', 'diagram_created', { diagramId: 'd1' }, T0 + 1);
    event(sql, 'renamed', 'diagram_renamed', { diagramId: 'd1', previousName: 'Payments' }, T0 + 2);

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items.map((e) => e.id)).toEqual(['created']);
    expect(await countUnseen(env, scope, T0, 99, T0 + DAY)).toBe(1);
  });
});
