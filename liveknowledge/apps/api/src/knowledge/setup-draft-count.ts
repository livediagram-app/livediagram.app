// Describe to Set Up's built-in count per account (docs/specs/030-knowledgebase/describe-to-set-up.md "The model",
// "Limits"; after liveplanner's plan-draft-count.ts). The room's own counters are one knowledgebase's, so a person
// could make a new knowledgebase for ten more: built-in AI is liveknowledge's bill, so each account has
// SETUP_BUILT_IN_PER_PERSON_PER_DAY suggestions a UTC day, wherever it asks.
//
// The count lives in one instance of the worker's DOCUMENT_ROOM Durable Object per account (no new binding, class or
// migration), under a name no document id can take: document ids are UUIDs, and none starts with `~`. The instance
// only ever holds the one storage key below, never a document's schema, so nothing that reads a document reaches it.
// It keeps no description, no reply and no account id: only the day and how many.
import { SETUP_BUILT_IN_PER_PERSON_PER_DAY } from '@liveknowledge/knowledge';
import type { Env } from '../types';

/** The storage key of the count, `{ day, count }`. */
export const SETUP_DRAFT_COUNT_KEY = 'setup-drafts';

/** The DOCUMENT_ROOM instance that keeps an account's count. */
export const setupDraftCountName = (accountId: string): string => `~setup-drafts:${accountId}`;

/** The UTC day `now` falls on, as `YYYY-MM-DD`: the count starts again from zero on a new one. */
export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

type CountStorage = Pick<DurableObjectStorage, 'get' | 'put'>;

/** The room's side: count one suggestion against `day`, unless `cap` is already spent. True when it may go ahead.
 *  A Durable Object runs one request's storage calls without another's between them, so two at once can't both
 *  take the last one. */
export async function spendSetupDraftIn(
  storage: CountStorage,
  day: string,
  cap: number,
): Promise<boolean> {
  const at = await storage.get<{ day: string; count: number }>(SETUP_DRAFT_COUNT_KEY);
  const count = at?.day === day ? at.count : 0;
  if (count >= cap) return false;
  await storage.put(SETUP_DRAFT_COUNT_KEY, { day, count: count + 1 });
  return true;
}

type CountRpc = { spendSetupDraft(day: string, cap: number): Promise<boolean> };

/**
 * Count one built-in suggestion for `accountId` against today's cap: `true` to go ahead, `false` at the cap,
 * `'unavailable'` when the count can't be reached. This cap guards a bill: a fault refuses the suggestion rather
 * than lifting the cap.
 */
export async function spendSetupDraft(
  env: Pick<Env, 'DOCUMENT_ROOM'>,
  accountId: string,
  now: number = Date.now(),
): Promise<boolean | 'unavailable'> {
  const ns = env.DOCUMENT_ROOM as Env['DOCUMENT_ROOM'] | undefined;
  if (!ns) return 'unavailable';
  try {
    const store = ns.get(ns.idFromName(setupDraftCountName(accountId))) as unknown as CountRpc;
    return await store.spendSetupDraft(utcDay(now), SETUP_BUILT_IN_PER_PERSON_PER_DAY);
  } catch (error) {
    console.warn(
      '[knowledge] setup count unavailable',
      error instanceof Error ? error.message : String(error),
    );
    return 'unavailable';
  }
}
