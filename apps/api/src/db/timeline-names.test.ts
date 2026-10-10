import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { countUnseen, readTimeline } from './timeline';

// Renames are not timeline moments (docs/specs/013-workspace/timeline.md §4.2): every entry names its
// document as it is called NOW, and the rename events written before that
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

function liveDoc(
  sql: DatabaseSync,
  id: string,
  name: string,
  ownerId = 'owner',
  teamId: string | null = null,
) {
  insert(sql, 'documents', {
    id,
    owner_id: ownerId,
    team_id: teamId,
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
  sourceId = snapshot.documentId ?? 'x',
) {
  insert(sql, 'timeline_events', {
    id,
    actor_id: 'someone',
    source_type: 'document',
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
  it('shows a document by its current name on entries from before a rename', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'd1', 'Payments v2');
    event(
      sql,
      'created',
      'document_created',
      { documentId: 'd1', documentName: 'Payments' },
      T0 + 1,
    );
    // A comment's source is its thread; the document is found through the snapshot.
    event(
      sql,
      'comment',
      'comment_added',
      { documentId: 'd1', documentName: 'Payments' },
      T0 + 2,
      'thread-1',
    );

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items.map((e) => e.snapshot.documentName)).toEqual(['Payments v2', 'Payments v2']);
  });

  it('keeps the saved name for a document that no longer exists', async () => {
    const { env, sql } = sqliteD1();
    event(sql, 'gone', 'document_deleted', { documentName: 'Old board' }, T0 + 1, 'deleted-id');
    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items[0]?.snapshot.documentName).toBe('Old board');
  });

  it('leaves rename events out of the feed and the unread count', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'd1', 'Payments v2');
    event(sql, 'created', 'document_created', { documentId: 'd1' }, T0 + 1);
    event(
      sql,
      'renamed',
      'document_renamed',
      { documentId: 'd1', previousName: 'Payments' },
      T0 + 2,
    );

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items.map((e) => e.id)).toEqual(['created']);
    expect(await countUnseen(env, scope, T0, 99, T0 + DAY)).toBe(1);
  });

  it('keeps the saved name for a document the reader can no longer open', async () => {
    const { env, sql } = sqliteD1();
    // Someone else's document, once shared with the reader; the link is gone.
    liveDoc(sql, 'd1', 'Secret plans v2', 'someone');
    event(sql, 'created', 'document_created', { documentId: 'd1', documentName: 'Plans' }, T0 + 1);

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items[0]?.snapshot.documentName).toBe('Plans');
  });

  it('follows the live name of a team document the reader can open, and not after they leave', async () => {
    const { env, sql } = sqliteD1();
    insert(sql, 'teams', { id: 'team', name: 'Team', created_at: T0, updated_at: T0 });
    insert(sql, 'team_members', {
      id: 'm-owner',
      team_id: 'team',
      user_id: 'owner',
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
    liveDoc(sql, 'd1', 'Roadmap v2', 'someone', 'team');
    event(
      sql,
      'created',
      'document_created',
      { documentId: 'd1', documentName: 'Roadmap' },
      T0 + 1,
    );

    const before = await readTimeline(env, { scope, limit: 10 });
    expect(before.items[0]?.snapshot.documentName).toBe('Roadmap v2');

    sql.prepare("UPDATE team_members SET status = 'left' WHERE id = 'm-owner'").run();
    const after = await readTimeline(env, { scope, limit: 10 });
    expect(after.items[0]?.snapshot.documentName).toBe('Roadmap');
  });

  it('shows the live name in a document feed, whose own gate the reader passed', async () => {
    const { env, sql } = sqliteD1();
    liveDoc(sql, 'd1', 'Board v2', 'someone');
    insert(sql, 'timeline_events', {
      id: 'e1',
      actor_id: 'someone',
      source_type: 'document',
      source_id: 'd1',
      event_type: 'document_created',
      title: 'Document Created',
      occurred_at: T0 + 1,
      snapshot: JSON.stringify({ documentId: 'd1', documentName: 'Board' }),
      created_at: T0,
    });
    insert(sql, 'timeline_event_scopes', {
      event_id: 'e1',
      scope_type: 'document',
      scope_id: 'd1',
      added_at: T0,
    });

    const page = await readTimeline(env, {
      scope: { scopeType: 'document', scopeId: 'd1' },
      readerId: 'visitor',
      limit: 10,
    });
    expect(page.items[0]?.snapshot.documentName).toBe('Board v2');
  });
});
