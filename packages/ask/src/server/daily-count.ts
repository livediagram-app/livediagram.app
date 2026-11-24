// Built-in AI's allowance for Ask AI, per account (liveworkspace/docs/specs/020-ask/ask.md "Built-in AI's
// allowance"): ASK_BUILT_IN_PER_PERSON_PER_DAY questions a UTC day in one app, wherever the person asks.
//
// The count lives in one instance of the app's existing item room Durable Object per account (no new binding, class
// or migration), under a name no item id can take: item ids are server-minted, and none starts with `~`. The instance
// only ever holds the one storage key below, never an item's schema, so nothing that reads an item has anything to do
// there. It keeps no question, no answer and no account id: only the day and how many.
import { ASK_BUILT_IN_PER_PERSON_PER_DAY, ASK_OWNER_CREDITS_BY_OTHERS_PER_DAY } from '../limits';

/** The storage key of the count, `{ day, count }`. */
export const ASK_COUNT_KEY = 'ask-ai';

/** The room instance that keeps an account's count. */
export const askCountName = (accountId: string): string => `~ask-ai:${accountId}`;

/** The room instance that keeps an item's count of questions charged to its owner's AI credits by others ("AI
 *  credits"): the same one storage key, under a name no item id can take. */
export const askOthersCountName = (itemId: string): string => `~ask-ai-others:${itemId}`;

/** The UTC day `now` falls on, as `YYYY-MM-DD`: the count starts again from zero on a new one. */
export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** The part of a Durable Object's storage the count reads and writes. */
export type AskCountStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

/** The room's side: count one question against `day`, unless `cap` is already spent. True when it may go ahead. A
 *  Durable Object runs one request's storage calls without another's between them, so two at once cannot both take
 *  the last one. */
export async function spendAskIn(
  storage: AskCountStorage,
  day: string,
  cap: number,
): Promise<boolean> {
  const at = await storage.get<{ day: string; count: number }>(ASK_COUNT_KEY);
  const count = at?.day === day ? at.count : 0;
  if (count >= cap) return false;
  await storage.put(ASK_COUNT_KEY, { day, count: count + 1 });
  return true;
}

/** The room's RPC method the count is asked through: each app's room class has it, answering `spendAskIn`. */
export type AskCountRpc = { spendAsk(day: string, cap: number): Promise<boolean> };

/** A Durable Object namespace, as far as the count needs it. */
export type AskCountNamespace = {
  idFromName(name: string): unknown;
  get(id: never): unknown;
};

// Count one in the instance `name` against `cap` for today: `'unavailable'` when it cannot be reached. A cap guards a
// bill: a fault refuses the question rather than lifting it.
async function countIn(
  rooms: AskCountNamespace | undefined | null,
  name: string,
  cap: number,
  now: number,
): Promise<boolean | 'unavailable'> {
  if (!rooms) return 'unavailable';
  try {
    const room = rooms.get(rooms.idFromName(name) as never) as AskCountRpc;
    return await room.spendAsk(utcDay(now), cap);
  } catch {
    // Only that it failed: the fault's own words could name the account or the item.
    console.warn('[ask] count_unavailable');
    return 'unavailable';
  }
}

/**
 * Count one built-in question for `accountId` against today's allowance: `true` to go ahead, `false` at the cap,
 * `'unavailable'` when the count cannot be reached or there is no room namespace.
 */
export function spendAsk(
  rooms: AskCountNamespace | undefined | null,
  accountId: string,
  now: number = Date.now(),
): Promise<boolean | 'unavailable'> {
  return countIn(rooms, askCountName(accountId), ASK_BUILT_IN_PER_PERSON_PER_DAY, now);
}

/** Count one question charged to `itemId`'s owner by someone who is not the owner or the owning team, against the
 *  item's day (`ASK_OWNER_CREDITS_BY_OTHERS_PER_DAY`). Only with Pro on. */
export function spendAskByOthers(
  rooms: AskCountNamespace | undefined | null,
  itemId: string,
  now: number = Date.now(),
): Promise<boolean | 'unavailable'> {
  return countIn(rooms, askOthersCountName(itemId), ASK_OWNER_CREDITS_BY_OTHERS_PER_DAY, now);
}
