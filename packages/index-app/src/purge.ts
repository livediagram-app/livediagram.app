// Dropping items' content for good (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Purging"): the index has already
// removed the rows (a permanent delete, the Trash's sweep, a closed account) and asks the app to drop what each
// item's Durable Object stores. A room that can't be reached is logged rather than failing the batch; the index
// keeps a tombstone for it and asks again.

// The app never waits on one room longer than this.
export const ROOM_PURGE_TIMEOUT_MS = 3_000;
// Rooms purged at a time, so a large purge is a steady trickle rather than one burst.
export const ROOM_PURGE_CONCURRENCY = 10;
// The most ids one bulk purge request may name.
export const BULK_PURGE_MAX = 100;

async function withTimeout(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('purge timeout')), ms);
  });
  try {
    await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Purges each item with `purgeOne`, ROOM_PURGE_CONCURRENCY at a time. Answers the ids purged and those not reached.
export async function purgeEach(
  ids: readonly string[],
  purgeOne: (id: string) => Promise<unknown>,
  options: { concurrency?: number; timeoutMs?: number } = {},
): Promise<{ purged: string[]; unreached: string[] }> {
  const concurrency = options.concurrency ?? ROOM_PURGE_CONCURRENCY;
  const timeoutMs = options.timeoutMs ?? ROOM_PURGE_TIMEOUT_MS;
  const purged: string[] = [];
  const unreached: string[] = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (id) => {
        try {
          await withTimeout(purgeOne(id), timeoutMs);
          purged.push(id);
        } catch (err) {
          console.warn('[room-purge] did not reach the room', { itemId: id, error: String(err) });
          unreached.push(id);
        }
      }),
    );
  }
  if (ids.length > 0)
    console.info('[room-purge] purged', { rooms: ids.length, unreached: unreached.length });
  return { purged, unreached };
}
