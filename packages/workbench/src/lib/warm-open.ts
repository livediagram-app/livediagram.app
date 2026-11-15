// The warm open of a cloud item (each product's docs/specs/006-*/offline-mode.md "Warm open of a cloud document",
// livediagram's blueprints/last-seen-copy.md "Warm open"): before auth settles, the editor's bootstrap asks
// readWarmCopy for the last seen copy of the item its address names, for the reader this browser expects, and paints
// it read-only while the ordinary load catches up. Nothing here throws or holds the load: every answer it cannot
// give is null, and the editor opens as it always did.
import type { LastSeenCopy, LastSeenFirstTab } from './api/last-seen-copies';
import { firstTabToLoad } from './tab-scope';

/** The copies the warm open reads (the product's follower or copies). */
export type WarmOpenCopies<Item> = {
  read: (reader: string, itemId: string) => Promise<LastSeenCopy<Item, unknown> | null>;
  readVia: (reader: string, code: string) => Promise<LastSeenCopy<Item, unknown> | null>;
  lastReader: () => Promise<string | null>;
};

/** What the address says: the item it names, the share code it carries, and its fragment (`#t=<tab>`). */
export type WarmOpenAddress = { itemId: string | null; shareCode: string | null; hash: string };

/** Who this browser expects to be reading: whether the signed-in hint says so, and the guest token's id. */
export type WarmOpenWho = { signedIn: boolean; guestId: string | null };

// An account's id: the guest's is `guest_…`, and the store holds one reader's copies at most.
const ACCOUNT_PREFIX = 'user_';

/** The tab a `#t=<id>` fragment names, as the seed reads it, or null. */
export function hashTabId(hash: string): string | null {
  const match = /t=([^&]+)/.exec(hash);
  return match ? match[1]! : null;
}

/** The reader whose copy may paint: the guest token's id, or, signed in, the account the store holds copies for. A
 *  signed-in browser whose store holds a guest's copies, or none, has no reader to expect. */
export async function expectedReader(
  copies: Pick<WarmOpenCopies<unknown>, 'lastReader'>,
  who: WarmOpenWho,
): Promise<string | null> {
  if (!who.signedIn) return who.guestId;
  const last = await copies.lastReader();
  return last !== null && last.startsWith(ACCOUNT_PREFIX) ? last : null;
}

/** The copy the warm open paints, or null: none for this reader, another way in (a different share code, or none
 *  where the copy came by one), no first tab kept, or a first tab that is not the one this open would show first. A
 *  share link's own address (`/<route>/shared?s=<code>`) names no item (or names `shared`, where the product reads
 *  that segment as an id): the copy kept under its code is read instead. */
export async function readWarmCopy<Item extends { tabs: readonly { id: string }[] }>(
  copies: WarmOpenCopies<Item>,
  address: WarmOpenAddress,
  who: WarmOpenWho,
): Promise<LastSeenCopy<Item, unknown> | null> {
  const { itemId, shareCode, hash } = address;
  if (!itemId && !shareCode) return null;
  try {
    const reader = await expectedReader(copies, who);
    if (!reader) return null;
    const named = itemId ? await copies.read(reader, itemId) : null;
    const copy = named ?? (shareCode ? await copies.readVia(reader, shareCode) : null);
    if (!copy || copy.via !== shareCode || !copy.firstTab) return null;
    const firstId = firstTabToLoad(copy.item.tabs, copy.access.tabScope);
    if (copy.firstTab.id !== firstId) return null;
    // The address pins another tab of the item: it would open there, on a tab the copy has no body for.
    const pinned = hashTabId(hash);
    if (pinned !== null && pinned !== firstId && copy.item.tabs.some((t) => t.id === pinned)) {
      return null;
    }
    return copy;
  } catch {
    return null;
  }
}

/** The painted tab, when the fresh load read the first tab at the revision the copy holds: the catch-up keeps it, so
 *  an unchanged canvas is not drawn again. Otherwise null, and the fresh tab replaces it. */
export function keptWarmTab<Tab>(
  warm: LastSeenFirstTab<unknown> | null | undefined,
  id: string,
  rev: number,
): Tab | null {
  return warm && warm.id === id && warm.rev === rev ? (warm.tab as Tab) : null;
}

/** The setters a load writes the screen through, each first calling `onLand`, except the `quiet` ones (who is reading,
 *  the name prompt) that change nothing a warm paint shows. A warm read answering after `onLand` has run is too late:
 *  the load has begun to show what it fetched, so the copy must not paint over it. Until then the read may still paint,
 *  even once the load has started (a guest's auth settles from the local token almost at once). */
export function markLanding<S extends object>(
  set: S,
  onLand: () => void,
  quiet: ReadonlySet<string>,
): S {
  return new Proxy(set, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      if (typeof value !== 'function' || (typeof key === 'string' && quiet.has(key))) return value;
      return (...args: unknown[]) => {
        onLand();
        return (value as (...a: unknown[]) => unknown)(...args);
      };
    },
  });
}

/** The setters with `key` (the page's not-found setter) checked first: a `true` that `intercept` takes over is never
 *  set. A Proxy, like markLanding's, so setters read lazily stay as they are. */
export function guardNotFound<S extends object>(set: S, key: string, intercept: () => boolean): S {
  return new Proxy(set, {
    get(target, k, receiver) {
      const value: unknown = Reflect.get(target, k, receiver);
      if (k !== key || typeof value !== 'function') return value;
      return (shown: unknown) => {
        if (shown === true && intercept()) return;
        (value as (v: unknown) => void)(shown);
      };
    },
  });
}

/** Why a warm open fell back to the ordinary load. */
export type WarmOpenFallbackReason = 'not-found';

export type WarmOpenFallbackDeps = {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  forget: () => Promise<unknown>;
  reload: () => void;
  warn: (line: string) => void;
};

// The session key that marks an item's fallback as taken, so a second not found in this tab's session shows.
const FALLBACK_KEY = 'warm-open-fallback:';

/** The warm open's safety net (offline-mode.md "Never a wrong not found"): a load that ends on not found after a warm
 *  paint forgets the copy and reloads, cold, once per item per tab session, so only an ordinary open's not found ever
 *  shows. True when it took over (the caller shows nothing); false when this session already fell back for the item,
 *  or the session store is unusable (the caller shows the not found, as a cold open would). */
export function warmOpenFallback(
  reason: WarmOpenFallbackReason,
  itemKey: string,
  deps: WarmOpenFallbackDeps,
): boolean {
  const key = `${FALLBACK_KEY}${itemKey}`;
  try {
    const store = deps.storage();
    if (store.getItem(key) !== null) return false;
    store.setItem(key, reason);
  } catch {
    // No session store: no way to know a reload is the first, so never risk a loop.
    return false;
  }
  deps.warn(`[load] warm-open-fallback ${reason}: reloading without the last seen copy`);
  // The forget never rejects and is bounded by the store's timeout; the reload follows either way.
  void deps
    .forget()
    .catch(() => {})
    .finally(() => deps.reload());
  return true;
}

/** The browser's fallback deps for an item's copy: this tab's session store, a console warning and a page reload. */
export function browserWarmOpenFallbackDeps(forget: () => Promise<unknown>): WarmOpenFallbackDeps {
  return {
    storage: () => window.sessionStorage,
    forget,
    reload: () => window.location.reload(),
    warn: (line) => console.warn(line),
  };
}

/** A performance measure named `name` from `from` (the load's start on the performance clock, or now) to the next
 *  frame on screen: the warm paint's and the catch-up's timing marks. */
export function measureAfterPaint(name: string, from: number | undefined): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  const start = from ?? performance.now();
  const measure = () => {
    try {
      performance.measure(name, { start, end: performance.now() });
    } catch {
      // A timing mark never throws into the open it times.
    }
  };
  if (typeof requestAnimationFrame !== 'function') measure();
  else requestAnimationFrame(() => setTimeout(measure, 0));
}
