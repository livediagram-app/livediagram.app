import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/diagram';
import { sqliteD1 } from '../test-sqlite-d1';
import { runTimelineExpirySweep } from '../timeline/expiry-sweep';
import { readActivity } from './collab-index';
import { tabLinkedToOwnedDiagram, upsertTab } from './tabs';
import { countUnseen, readTimeline } from './timeline';
import { restoreDiagram, trashDiagram } from './trash';

// The surfaces a trashed diagram leaves while it waits
// (docs/specs/013-workspace/trash.md, "While a diagram is in the Trash"):
// hidden, never swept, so a restore brings every one of them back.

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function diagram(sql: DatabaseSync, id: string) {
  insert(sql, 'diagrams', {
    id,
    owner_id: 'owner',
    name: id,
    shareable: 1,
    saved_at: T0,
    created_at: T0,
  });
}

function event(sql: DatabaseSync, id: string, sourceId: string, diagramId: string) {
  insert(sql, 'timeline_events', {
    id,
    actor_id: 'someone',
    source_type: 'diagram',
    source_id: sourceId,
    event_type: 'comment_added',
    title: 'Comment Added',
    occurred_at: T0 + 1,
    snapshot: JSON.stringify({ diagramId }),
    created_at: T0,
  });
  insert(sql, 'timeline_event_scopes', {
    event_id: id,
    scope_type: 'user',
    scope_id: 'owner',
    added_at: T0,
  });
}

describe('Timeline, while a diagram is in the Trash', () => {
  it('hides its events, by source and by snapshot, and counts none unseen', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    diagram(sql, 'B');
    event(sql, 'own', 'A', 'A');
    event(sql, 'thread', 'thread-1', 'A');
    event(sql, 'other', 'B', 'B');
    const scope = { scopeType: 'user' as const, scopeId: 'owner' };

    await trashDiagram(env, 'A', T0);

    const page = await readTimeline(env, { scope, limit: 10 });
    expect(page.items.map((e) => e.id)).toEqual(['other']);
    expect(await countUnseen(env, scope, T0, 99, T0 + DAY)).toBe(1);
  });

  it('brings them back on restore', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    event(sql, 'own', 'A', 'A');
    const scope = { scopeType: 'user' as const, scopeId: 'owner' };
    await trashDiagram(env, 'A', T0);

    await restoreDiagram(env, 'A', T0 + DAY);

    expect((await readTimeline(env, { scope, limit: 10 })).items.map((e) => e.id)).toEqual(['own']);
  });
});

describe('Activity, while a diagram is in the Trash', () => {
  it('leaves out its open actions', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'A');
    await upsertTab(db.env, 'A', { id: 't1', name: 't1', elements: [] } as unknown as Tab, 0);
    insert(db.sql, 'collab_actions', {
      tab_id: 't1',
      element_id: 'e1',
      action_id: 'a1',
      element_label: 'Box',
      name: 'Do it',
      description: '',
      status: 'open',
      assigner_id: 'owner',
      created_at: T0,
      updated_at: T0,
    });
    expect((await readActivity(db.env, 'owner', { limit: 10 })).actions).toHaveLength(1);

    await trashDiagram(db.env, 'A', T0);

    expect((await readActivity(db.env, 'owner', { limit: 10 })).actions).toEqual([]);
  });
});

describe('linking a tab, while its only owned diagram is in the Trash', () => {
  it('is refused', async () => {
    const db = sqliteD1();
    diagram(db.sql, 'A');
    await upsertTab(db.env, 'A', { id: 't1', name: 't1', elements: [] } as unknown as Tab, 0);
    expect(await tabLinkedToOwnedDiagram(db.env, 't1', 'owner')).toBe(true);

    await trashDiagram(db.env, 'A', T0);

    expect(await tabLinkedToOwnedDiagram(db.env, 't1', 'owner')).toBe(false);
  });
});

describe('the share-link expiry sweep, while a diagram is in the Trash', () => {
  it('does not warn about its links', async () => {
    const { env, sql } = sqliteD1();
    diagram(sql, 'A');
    const now = T0 + DAY;
    insert(sql, 'share_links', {
      code: 'c',
      diagram_id: 'A',
      role: 'edit',
      created_at: T0,
      expires_at: now + DAY,
    });
    await trashDiagram(env, 'A', T0);

    expect(await runTimelineExpirySweep(env, now)).toBe(0);
  });
});
