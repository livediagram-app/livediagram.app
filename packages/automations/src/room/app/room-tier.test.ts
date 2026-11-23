// An item room's tier over its head row (room-tier.ts): the owner read synchronously, and the isolate's one cache.
import { describe, expect, it } from 'vitest';
import { forgetEntitlementsForTests } from '@liveworkspace/subscription';
import { fakeSubscription } from '@liveworkspace/subscription/testing';
import type { Sql } from '../sql';
import { itemDb } from '../item/test-kit';
import { roomHeadOf, roomTier } from './room-tier';

function headDb(): Sql {
  const { sql } = itemDb(false);
  sql.exec('CREATE TABLE document (id TEXT PRIMARY KEY, owner_id TEXT, team_id TEXT, name TEXT)');
  return sql;
}

describe('a room’s tier', () => {
  it('reads the head row, nothing before the schema stands or with no owner', () => {
    const sql = headDb();
    let ready = false;
    let id: string | null = null;
    const input = { sql: () => sql, ready: () => ready, table: 'document' as const, id: () => id };
    expect(roomHeadOf(input)).toBeNull();
    id = 'd1';
    expect(roomHeadOf(input)).toBeNull();
    ready = true;
    expect(roomHeadOf(input)).toBeNull();
    sql.exec("INSERT INTO document VALUES ('d1', '', NULL, NULL)");
    expect(roomHeadOf(input)).toBeNull();
    sql.exec("UPDATE document SET owner_id = 'user_ana' WHERE id = 'd1'");
    expect(roomHeadOf(input)).toEqual({ ownerId: 'user_ana', teamId: null, name: '' });
    sql.exec("UPDATE document SET team_id = 'team_1', name = 'Notes' WHERE id = 'd1'");
    expect(roomHeadOf(input)).toEqual({ ownerId: 'user_ana', teamId: 'team_1', name: 'Notes' });
  });

  it('asks the owner’s service with Pro on, and nothing before the room has an env', async () => {
    const sql = headDb();
    sql.exec("INSERT INTO document VALUES ('d1', 'user_ana', NULL, 'Notes')");
    const fake = fakeSubscription({ 'p:user_ana': 'pro' });
    const env = { PRO_ENABLED: 'true', SUBSCRIPTION_KEY: 'key', SUBSCRIPTION: fake.fetcher };
    const base = {
      app: 'livedocuments.app' as const,
      sql: () => sql,
      ready: () => true,
      table: 'document' as const,
      id: () => 'd1',
      defer: () => {},
    };
    const none = roomTier({ ...base, env: () => null });
    expect(none.on).toBe(false);
    const tier = roomTier({ ...base, env: () => env });
    await tier.refresh();
    expect(tier.limit('automationRules', 50)).toBe(500);
    // A second room of the same app shares the isolate's read.
    const again = roomTier({ ...base, env: () => env });
    await again.refresh();
    expect(fake.to('entitlement')).toHaveLength(1);
    forgetEntitlementsForTests();
    const after = roomTier({ ...base, env: () => env });
    await after.refresh();
    expect(fake.to('entitlement')).toHaveLength(2);
  });
});
