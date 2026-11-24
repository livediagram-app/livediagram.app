// The room's side of its sources (document-room-sources.ts): owing work wakes the alarm, and the index's signal is
// taken only by a room that has started.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { dueWork } from '../knowledge/knowledge-work';
import { SOURCE_SYNC_KEY } from '../knowledge/source-work';
import { migrateDocumentSchema } from './document-schema';
import type { DocumentRoom } from './document-room';
import { oweSourceSync, oweSources, takeKnowledgeSourceChange } from './document-room-sources';

vi.mock('./document-room-content', () => ({ ensureSchema: vi.fn() }));

function fakeRoom(started = true) {
  const sql = nodeItemSql(new DatabaseSync(':memory:'));
  migrateDocumentSchema((q) => sql.exec(q));
  const wake = vi.fn();
  const room = {
    state: { storage: { sql } },
    knowledge: { wake },
    bindDocument: vi.fn(),
    storedSchema: () => started,
  } as unknown as DocumentRoom;
  return { room, sql, wake };
}

describe('the room and its sources', () => {
  it('owes work and wakes the alarm for it', () => {
    const { room, sql, wake } = fakeRoom();
    oweSources(room, 'd1', 5);
    oweSourceSync(room);
    expect(wake).toHaveBeenCalledTimes(2);
    expect(
      dueWork(sql, Date.now() + 60_000, 10)
        .map((w) => w.key)
        .sort(),
    ).toEqual(['d1', SOURCE_SYNC_KEY]);
  });

  it('takes a change signal only once the room has started', () => {
    const started = fakeRoom();
    takeKnowledgeSourceChange(started.room, 'kb', { app: 'livediagram', itemId: 'new' });
    expect(started.wake).toHaveBeenCalledTimes(1);
    takeKnowledgeSourceChange(started.room, 'kb', { app: 'livediagram', itemId: 'x', gone: true });
    expect(started.wake).toHaveBeenCalledTimes(1);
    const fresh = fakeRoom(false);
    takeKnowledgeSourceChange(fresh.room, 'kb', { app: 'livediagram', itemId: 'new' });
    expect(fresh.wake).not.toHaveBeenCalled();
  });
});
