import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  dueForActivation,
  dueForStage,
  dueForWinback,
  getOwnerEmail,
  markStageSent,
  MAX_SEND_ATTEMPTS,
  ownerActiveStatement,
  recordSendFailure,
  recordSighting,
} from './email-lifecycle';

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

// docs/specs/014-identity/transactional-email.md §5: a row that keeps failing leaves every sweep after
// MAX_SEND_ATTEMPTS, so it cannot hold a place in the oldest-first batch for good.
describe('send attempts', () => {
  const NOW = 10 * 365 * 24 * 60 * 60 * 1000;

  function withQuietOwner() {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO email_lifecycle (owner_id, email, created_at) VALUES ('user_a', 'a@x.test', 1)`,
      )
      .run();
    return db;
  }
  const due = async (db: ReturnType<typeof sqliteD1>) => ({
    week1: (await dueForStage(db.env, 'week1', NOW, 10)).length,
    week2: (await dueForStage(db.env, 'week2', NOW, 10)).length,
  });

  it('drops a row from every due-query once it has failed MAX_SEND_ATTEMPTS times', async () => {
    const db = withQuietOwner();
    for (let i = 1; i < MAX_SEND_ATTEMPTS; i++) {
      expect(await recordSendFailure(db.env, 'user_a')).toBe(i);
    }
    expect(await due(db)).toEqual({ week1: 1, week2: 1 });
    expect(await recordSendFailure(db.env, 'user_a')).toBe(MAX_SEND_ATTEMPTS);
    expect(await due(db)).toEqual({ week1: 0, week2: 0 });
    const row = db.sql
      .prepare(`SELECT last_attempt_at FROM email_lifecycle WHERE owner_id = 'user_a'`)
      .get() as { last_attempt_at: number | null };
    expect(row.last_attempt_at).not.toBeNull();
  });

  it('keeps a failing zero-project signup out of the activation nudge too', async () => {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO email_lifecycle (owner_id, email, created_at) VALUES ('user_b', 'b@x.test', 1)`,
      )
      .run();
    expect(await dueForActivation(db.env, NOW, 10)).toHaveLength(1);
    for (let i = 0; i < MAX_SEND_ATTEMPTS; i++) await recordSendFailure(db.env, 'user_b');
    expect(await dueForActivation(db.env, NOW, 10)).toHaveLength(0);
  });

  it('leaves an owner who has saved a plan out of the activation nudge', async () => {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO email_lifecycle (owner_id, email, created_at) VALUES ('user_b', 'b@x.test', 1)`,
      )
      .run();
    await ownerActiveStatement(db.env, 'user_b', 5).run();
    expect(await dueForActivation(db.env, NOW, 10)).toHaveLength(0);
  });

  it('gives the row a clean count on a success or a changed address', async () => {
    const db = withQuietOwner();
    await recordSendFailure(db.env, 'user_a');
    await markStageSent(db.env, 'user_a', 'welcome');
    expect(await recordSendFailure(db.env, 'user_a')).toBe(1);
    for (let i = 1; i < MAX_SEND_ATTEMPTS; i++) await recordSendFailure(db.env, 'user_a');
    expect(await due(db)).toEqual({ week1: 0, week2: 0 });
    await recordSighting(db.env, 'user_a', 'fixed@x.test');
    expect(await due(db)).toEqual({ week1: 1, week2: 1 });
  });
});

// docs/specs/014-identity/transactional-email.md #7: win-back reads the owner's newest save, which each plan's
// summary push stamps (plan-outbox.ts), so it runs against the real schema.
describe('dueForWinback', () => {
  const CUTOFF = 1_000;

  function withOwner(savedAt: number[]) {
    const db = sqliteD1();
    db.sql
      .prepare(
        `INSERT INTO email_lifecycle (owner_id, email, created_at) VALUES ('user_a', 'a@x.test', 1)`,
      )
      .run();
    return { db, saves: savedAt };
  }

  async function stamped(savedAt: number[]) {
    const { db, saves } = withOwner(savedAt);
    for (const at of saves) await ownerActiveStatement(db.env, 'user_a', at).run();
    return db;
  }

  it('picks an owner whose newest save is at or before the cutoff', async () => {
    const db = await stamped([CUTOFF, 10]);
    expect(await dueForWinback(db.env, CUTOFF, 10)).toEqual([
      { ownerId: 'user_a', email: 'a@x.test' },
    ]);
  });

  it('skips an owner who saved after the cutoff, and one with no projects', async () => {
    expect(await dueForWinback((await stamped([10, CUTOFF + 1])).env, CUTOFF, 10)).toEqual([]);
    expect(await dueForWinback((await stamped([])).env, CUTOFF, 10)).toEqual([]);
  });
});
