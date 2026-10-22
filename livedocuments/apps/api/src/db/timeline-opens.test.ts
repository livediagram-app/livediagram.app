import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { recordDocumentOpen } from '../home/record-open';
import { countUnseen, readTimeline } from './timeline';
import { recordDocumentEdited } from '../timeline';

// A person's own opens live in their user scope for Home, and stay out of the Timeline feed and
// its unread count (docs/specs/013-workspace/timeline.md §4.2, "A person's own opens").

const NOW = 1_700_000_000_000;
const DOC = { id: 'd1', name: 'Payments', ownerId: 'owner', teamId: null };
const scope = { scopeType: 'user' as const, scopeId: 'owner' };
let db: SqliteD1;

beforeEach(() => {
  db = sqliteD1();
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('d1', 'owner', 'Payments', 0, 1, 1)`);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('opens and the Timeline feed', () => {
  it('leaves an open out of the feed but keeps the edit beside it', async () => {
    await recordDocumentOpen(db.env, DOC, 'owner', NOW);
    await recordDocumentEdited(db.env, DOC, 'owner');
    const page = await readTimeline(db.env, { scope, limit: 50 });
    expect(page.items.map((e) => e.eventType)).toEqual(['document_edited']);
  });

  it('never counts an open as unread, even one written under another id', async () => {
    await recordDocumentOpen(db.env, DOC, 'owner', NOW);
    // As after a sign-up migration that left the guest id on an older row.
    db.sql.exec(
      "UPDATE timeline_events SET actor_id = 'guest-old' WHERE event_type = 'document_opened'",
    );
    expect(await countUnseen(db.env, scope, NOW - 1, 99, NOW + 1)).toBe(0);
  });
});
