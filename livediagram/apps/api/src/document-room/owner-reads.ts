// The photo reads charged to a diagram's owner by someone else, per UTC day (docs/specs/021-event-storming/
// note-reader.md "A collaborator's reads"). An Editor who is not the owner or a member of the owning team spends the
// owner's AI credits when they read a photo into the diagram, so the diagram itself holds how many such reads it has
// taken today, in its own storage, under one key holding the day and its count. A new UTC day starts from zero. Only
// with Pro on: with it off nothing here is called and the key is never written.

/** The storage key of the count, `{ day, count }`. */
export const OWNER_READS_KEY = 'ai-owner-reads';

type CountStorage = Pick<DurableObjectStorage, 'get' | 'put'>;

/** The UTC day `now` falls on, as `YYYY-MM-DD`. */
export const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** One more read counted against `day`, unless `cap` is already reached. True when it may go ahead. A Durable Object
 *  runs one call's storage reads and writes without another's between them, so two at once never both take the last. */
export async function takeOwnerReadIn(
  storage: CountStorage,
  day: string,
  cap: number,
): Promise<boolean> {
  const at = await storage.get<{ day: string; count: number }>(OWNER_READS_KEY);
  const count = at?.day === day ? at.count : 0;
  if (count >= cap) return false;
  await storage.put(OWNER_READS_KEY, { day, count: count + 1 });
  return true;
}

/** Give back a read taken against `day` that spent nothing (the owner's credits refused it), so a refused read never
 *  uses up one of the day's slots. A count from another day, or none, is left as it is. */
export async function giveBackOwnerReadIn(storage: CountStorage, day: string): Promise<void> {
  const at = await storage.get<{ day: string; count: number }>(OWNER_READS_KEY);
  if (at?.day !== day || at.count <= 0) return;
  await storage.put(OWNER_READS_KEY, { day, count: at.count - 1 });
}
