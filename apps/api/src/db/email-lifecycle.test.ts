import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { getOwnerEmail, recordSighting } from './email-lifecycle';

// docs/specs/014-identity/transactional-email.md §4: the sighting creates the row once (sign-up) and keeps its
// address in step with the verified token afterwards.
describe('recordSighting', () => {
  it('reports a new row only on the first sighting', async () => {
    const db = sqliteD1();
    expect(await recordSighting(db.env, 'user_a', 'a@x.test')).toBe(true);
    expect(await recordSighting(db.env, 'user_a', 'a@x.test')).toBe(false);
    expect(await getOwnerEmail(db.env, 'user_a')).toBe('a@x.test');
  });

  it('moves a returning owner to their changed address, without a second sign-up', async () => {
    const db = sqliteD1();
    await recordSighting(db.env, 'user_a', 'old@x.test');
    expect(await recordSighting(db.env, 'user_a', 'new@x.test')).toBe(false);
    expect(await getOwnerEmail(db.env, 'user_a')).toBe('new@x.test');
  });

  it('leaves a backfilled suppression row on its empty sentinel', async () => {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO email_lifecycle (owner_id, email, created_at, welcome_sent_at, week1_sent_at, week2_sent_at)
         VALUES ('user_a', '', 0, 0, 0, 0)`,
      )
      .run();
    expect(await recordSighting(db.env, 'user_a', 'a@x.test')).toBe(false);
    expect(await getOwnerEmail(db.env, 'user_a')).toBeNull();
  });
});
