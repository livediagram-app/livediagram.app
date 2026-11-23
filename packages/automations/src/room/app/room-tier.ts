// An item room's tier (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an item"), for every
// app whose room keeps its head as one row (`document` or `design`: id, name, owner_id, team_id): the platform's
// ItemTier over that row, read synchronously, and the room's background work. With Pro off (or a room with no env)
// it asks nothing and every limit is the legacy one.
import {
  ItemTier,
  subscriptionClientOf,
  type SubscriptionApp,
  type SubscriptionEnv,
  type TierHead,
} from '@liveworkspace/subscription';
import type { Sql } from '../sql';

type HeadRow = { owner_id: string | null; name: string | null; team_id: string | null };

export interface RoomTierInput {
  app: SubscriptionApp;
  // The room's env, or null before it has one.
  env: () => SubscriptionEnv | null;
  sql: () => Sql;
  // Whether the room's schema stands.
  ready: () => boolean;
  table: 'document' | 'design';
  // The item's id, or null while the room holds none.
  id: () => string | null;
  defer: (work: Promise<unknown>) => void;
}

/** The item's head as its row holds it now: one synchronous read by its key; null with no owner yet. */
export function roomHeadOf(
  input: Pick<RoomTierInput, 'sql' | 'ready' | 'table' | 'id'>,
): TierHead | null {
  const id = input.id();
  if (id === null || !input.ready()) return null;
  const row = input
    .sql()
    .exec(`SELECT owner_id, team_id, name FROM ${input.table} WHERE id = ?`, id)
    .toArray()[0] as HeadRow | undefined;
  if (!row?.owner_id) return null;
  return { ownerId: row.owner_id, teamId: row.team_id ?? null, name: row.name ?? '' };
}

export function roomTier(input: RoomTierInput): ItemTier {
  return new ItemTier({
    // The isolate's one cache of entitlements (the client's own), so the rooms of one owner's items share a read.
    client: () => {
      const env = input.env();
      return env ? subscriptionClientOf(env, input.app) : null;
    },
    head: () => roomHeadOf(input),
    defer: input.defer,
  });
}
