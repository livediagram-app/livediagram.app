import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { claimCommentNotify, claimJoinNotify } from './documents';

const WINDOW = 15 * 60 * 1000;

// docs/specs/014-identity/profile-and-email-notifications.md (a): one join email per document per window, on
// its own column so the comment email's window is untouched.
describe('claimJoinNotify', () => {
  function withDocument() {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
      )
      .run();
    return db;
  }

  it('wins once inside a window, then again once it has passed', async () => {
    const db = withDocument();
    const t = 1_000_000_000;
    expect(await claimJoinNotify(db.env, 'd', t, t - WINDOW)).toBe(true);
    expect(await claimJoinNotify(db.env, 'd', t + 1000, t + 1000 - WINDOW)).toBe(false);
    const later = t + WINDOW + 1;
    expect(await claimJoinNotify(db.env, 'd', later, later - WINDOW)).toBe(true);
  });

  it('leaves the comment window alone', async () => {
    const db = withDocument();
    const t = 1_000_000_000;
    expect(await claimJoinNotify(db.env, 'd', t, t - WINDOW)).toBe(true);
    expect(await claimCommentNotify(db.env, 'd', t, t - WINDOW)).toBe(true);
  });

  it('claims nothing for a document that does not exist', async () => {
    const db = sqliteD1();
    expect(await claimJoinNotify(db.env, 'missing', 1, 0)).toBe(false);
  });
});
