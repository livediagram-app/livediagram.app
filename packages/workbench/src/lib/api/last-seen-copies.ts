// The last seen copy (each product's docs/specs/006-*/offline-mode.md "Warm open of a cloud document", livediagram's
// blueprints/last-seen-copy.md): what one load answered for one reader and cloud item, kept in this browser so a later
// open can paint it before auth, the participant and the tab fetch settle. One copy per reader and item; every keep
// and forget prunes the other readers' copies and those past the limits; sign-out clears them all. The product binds
// the storage (`LastSeenStore`, last-seen-store.ts); nothing here throws.
import { parseStoredLevel, type AccessLevel } from '@liveworkspace/api-schema/access-levels';
import { debugLog } from '../debug-log';
import type { LastSeenRecord, LastSeenStore } from './last-seen-store';

/** How many copies a browser keeps for a product, the oldest seen dropped first. Safe range: 5 to 50. */
export const LAST_SEEN_MAX_COPIES = 20;
/** The longest copy JSON kept, about 4,000 shape elements (a 2,000-element tab's copy measured 480 KB). Past it none
 *  is kept and the item opens as it always did. Safe range: 250,000 to 4,000,000. */
export const LAST_SEEN_MAX_CHARS = 1_000_000;
/** How long a copy may be read after it was seen. Safe range: 1 to 90 days. */
export const LAST_SEEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const LAST_SEEN_VERSION = 1;

/** How the reader came in, as the arrival set it. */
export type LastSeenAccess = {
  role: AccessLevel;
  isOwner: boolean;
  // The share code the reader's writes present (a visitor's), or null.
  sessionShareCode: string | null;
  // The one tab a tab-scoped link opens, or null for all.
  tabScope: string | null;
};

/** The tab the load painted first, with the revision it was read at. */
export type LastSeenFirstTab<Tab> = { id: string; rev: number; tab: Tab };

/** One copy, as read back. */
export type LastSeenCopy<Item, Tab> = {
  reader: string;
  itemId: string;
  seenAt: number;
  item: Item;
  firstTab: LastSeenFirstTab<Tab> | null;
  // The share code the address carried (`?s=`), or null for the item's own address.
  via: string | null;
  access: LastSeenAccess;
};

/** What a keep is given: the copy without its time, its role as the arrival had it. */
export type LastSeenInput<Item, Tab> = Omit<LastSeenCopy<Item, Tab>, 'seenAt' | 'access'> & {
  access: Omit<LastSeenAccess, 'role'> & { role: string };
};

/** The two doors an arrival uses. */
export type LastSeenDoors<Item> = {
  remember: (copy: LastSeenInput<Item, unknown>) => Promise<void>;
  forget: (reader: string, itemId: string) => Promise<void>;
  // The reader lost what a share link opens: every copy kept by that code goes.
  forgetVia?: (reader: string, code: string) => Promise<void>;
};

/** The key a copy is stored under: one per reader and item. */
export function lastSeenKey(reader: string, itemId: string): string {
  return `${reader}\n${itemId}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

// The body's parts, checked: null for anything that is not a copy this code wrote.
function parseBody(
  body: string,
): Pick<LastSeenCopy<unknown, unknown>, 'item' | 'firstTab' | 'via' | 'access'> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.item) || !isRecord(parsed.access)) return null;
  const { item, firstTab, via, access } = parsed;
  if (!isStringOrNull(via)) return null;
  if (!isStringOrNull(access.sessionShareCode) || !isStringOrNull(access.tabScope)) return null;
  if (
    firstTab !== null &&
    !(
      isRecord(firstTab) &&
      typeof firstTab.id === 'string' &&
      typeof firstTab.rev === 'number' &&
      isRecord(firstTab.tab)
    )
  )
    return null;
  return {
    item,
    firstTab: firstTab as LastSeenFirstTab<unknown> | null,
    via,
    access: {
      // A role this code does not know reads as Viewer: a stored copy never widens what its reader may do.
      role: parseStoredLevel(access.role),
      isOwner: access.isOwner === true,
      sessionShareCode: access.sessionShareCode,
      tabScope: access.tabScope,
    },
  };
}

export function createLastSeenCopies<Item, Tab>(
  store: LastSeenStore,
  { now = Date.now }: { now?: () => number } = {},
) {
  // Every other reader's copies, those past the age limit, and this reader's past the newest LAST_SEEN_MAX_COPIES.
  async function prune(reader: string): Promise<void> {
    const at = now();
    const mine: { key: string; seenAt: number }[] = [];
    const drop: string[] = [];
    for (const entry of await store.entries()) {
      if (entry.reader !== reader || at - entry.seenAt > LAST_SEEN_MAX_AGE_MS) drop.push(entry.key);
      else mine.push(entry);
    }
    mine.sort((a, b) => b.seenAt - a.seenAt);
    for (const old of mine.slice(LAST_SEEN_MAX_COPIES)) drop.push(old.key);
    await store.remove(drop);
  }

  const copies = {
    /** Keep a copy (replacing the reader's older one of the item), then prune. */
    async remember(copy: LastSeenInput<Item, Tab>): Promise<void> {
      const key = lastSeenKey(copy.reader, copy.itemId);
      const body = JSON.stringify({
        item: copy.item,
        firstTab: copy.firstTab,
        via: copy.via,
        access: copy.access,
      });
      if (body.length > LAST_SEEN_MAX_CHARS) {
        // Too big to keep: an older copy under the key would read stale, so it goes too.
        debugLog('[last-seen] copy too big to keep', { chars: body.length });
        await store.remove([key]);
      } else {
        await store.put(key, {
          v: LAST_SEEN_VERSION,
          reader: copy.reader,
          itemId: copy.itemId,
          seenAt: now(),
          via: copy.via,
          body,
        });
      }
      await prune(copy.reader);
    },

    /** The reader's copy of the item, or null. Anything that is not a valid, current copy for them is removed. */
    async read(reader: string, itemId: string): Promise<LastSeenCopy<Item, Tab> | null> {
      const key = lastSeenKey(reader, itemId);
      const record = await store.get(key);
      if (record === undefined) return null;
      const valid =
        isRecord(record) &&
        record.v === LAST_SEEN_VERSION &&
        record.reader === reader &&
        record.itemId === itemId &&
        typeof record.seenAt === 'number' &&
        now() - record.seenAt <= LAST_SEEN_MAX_AGE_MS &&
        typeof record.body === 'string';
      const parts = valid ? parseBody(record.body as string) : null;
      if (!parts) {
        debugLog('[last-seen] dropped a record that is not a current copy', { itemId });
        await store.remove([key]);
        return null;
      }
      return {
        reader,
        itemId,
        seenAt: (record as LastSeenRecord).seenAt,
        ...(parts as Pick<LastSeenCopy<Item, Tab>, 'item' | 'firstTab' | 'via' | 'access'>),
      };
    },

    /** Whose copies the store holds: the reader of the newest seen copy, or null with none. Prune leaves one reader's
     *  copies at most, so this is the reader the last load ran as (the warm open's expected account). */
    async lastReader(): Promise<string | null> {
      let newest: { reader: string; seenAt: number } | null = null;
      for (const entry of await store.entries()) {
        if (newest === null || entry.seenAt > newest.seenAt) newest = entry;
      }
      return newest?.reader ?? null;
    },

    /** The reader's newest copy kept by the share code `code`, or null: a link's own address (`/<route>/shared?s=`)
     *  names no item, so the code finds it. The copy is read as `read` reads it, so it is checked the same way. */
    async readVia(reader: string, code: string): Promise<LastSeenCopy<Item, Tab> | null> {
      let newest: { key: string; seenAt: number } | null = null;
      for (const entry of await store.entries()) {
        if (entry.reader !== reader || entry.via !== code) continue;
        if (newest === null || entry.seenAt > newest.seenAt) newest = entry;
      }
      if (newest === null) return null;
      const copy = await copies.read(reader, newest.key.slice(reader.length + 1));
      return copy?.via === code ? copy : null;
    },

    /** The reader lost the item (not found, deleted, a password now asked): its copy goes. */
    async forget(reader: string, itemId: string): Promise<void> {
      await store.remove([lastSeenKey(reader, itemId)]);
      await prune(reader);
    },

    /** The reader lost what the share code `code` opens: every copy of theirs kept by it goes. */
    async forgetVia(reader: string, code: string): Promise<void> {
      const drop = (await store.entries())
        .filter((entry) => entry.reader === reader && entry.via === code)
        .map((entry) => entry.key);
      await store.remove(drop);
      await prune(reader);
    },

    /** Sign-out and account deletion: every copy goes. */
    forgetAll: (): Promise<void> => store.clear(),
  };
  return copies;
}
