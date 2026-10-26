// The index's grant on an item (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an editor holds it: a
// ten-minute token naming the item, the level and the tab, which the app's api and the item's room check offline.
// The editor asks for it while the item's code loads, keeps it until a minute before it lapses, and sends it with
// every request about that item as `X-Index-Grant`, and on the room's upgrade as the ticket.
//
// One request per item and link per ten minutes: concurrent callers share the one in flight (one with a different
// password asks on its own, and the newer answer stands), and the open item's
// grant is fetched again a minute before it lapses so a save never waits on it. Each app makes one set with
// createItemGrants, naming its index client, the window global its boot script leaves an early grant on, and the
// api path segment its items live under (`/api/<segment>/<id>`).
import { IndexError, type IndexClient } from '../client';
import { ITEM_GRANT_HEADER, SHARE_CODE_HEADER, SHARE_PASSWORD_HEADER } from '../constants';
import type { GrantResponse } from '../types';

export { ITEM_GRANT_HEADER };
// Fetched again this long before it lapses (the contract's renewal window).
export const GRANT_RENEW_BEFORE_MS = 60_000;
// A refusal is remembered this long, so an item the person cannot open is not asked about on every request.
export const GRANT_REFUSAL_MEMORY_MS = 30_000;
// A renewal the network failed is tried again after this long.
export const GRANT_RETRY_MS = 15_000;
// Items held at once; the oldest goes first. A person has one or two open.
export const GRANTS_HELD_MAX = 32;

export type ItemShare = { code: string; password?: string | null } | null;

/** What an inline boot script leaves on `window[bootGlobal]`: the grant asked for before the page's code loaded. */
export type EarlyGrant = { id: string; share: string; p: Promise<GrantResponse | null> };

export type ItemGrantOptions = {
  client: () => Pick<IndexClient, 'grant'>;
  /** The window global the app's boot script sets (`__ldesGrant`), or null when it has none. */
  bootGlobal: string | null;
  /** The api path segment items live under: `designs` for `/api/designs/<id>`. */
  itemsSegment: string;
  /** Reads that name their item in the query rather than the path: an image read through the item that places it,
   *  `/api/images/<image>?d=<item>`, is `{ segment: 'images', param: 'd' }`. */
  queryItems?: readonly { segment: string; param: string }[];
};

export type ItemGrants = {
  seed: (itemId: string, grant: GrantResponse, share?: ItemShare) => void;
  grant: (
    itemId: string,
    share?: ItemShare,
    opts?: { fresh?: boolean },
  ) => Promise<GrantResponse | null>;
  held: (itemId: string, share?: ItemShare) => string | null;
  refusal: (itemId: string, share?: ItemShare) => string | null;
  keepFresh: (itemId: string, share?: ItemShare) => () => void;
  itemIdOfPath: (apiBase: string, url: string) => string | null;
  withGrant: (
    apiBase: string,
    input: string,
    init: RequestInit | undefined,
  ) => Promise<RequestInit | undefined>;
  resetForTests: () => void;
};

type Held = {
  grant: GrantResponse | null;
  // When this answer stops being used: a minute before the grant lapses, or when a refusal is forgotten.
  until: number;
  // Which request answered it (counting up): an answer to an older request never replaces a newer one's.
  seq: number;
};

export function createItemGrants(opts: ItemGrantOptions): ItemGrants {
  const held = new Map<string, Held>();
  const inflight = new Map<string, Promise<GrantResponse | null>>();
  const renewTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // How many callers keep each item fresh (keepFresh); its renewals run while any do.
  const freshKeepers = new Map<string, number>();
  // Why the last request was refused, by key, for the callers that say so (a password prompt).
  const refusals = new Map<string, string>();

  const keyOf = (itemId: string, share: ItemShare) => `${itemId}|${share?.code ?? ''}`;
  // Requests in flight are shared per item, link and password: one sent with a password typed meanwhile never joins
  // one sent without it (or with the wrong one), whose refusal it would otherwise be handed.
  const flightOf = (key: string, share: ItemShare) => `${key}|${share?.password ?? ''}`;
  let requests = 0;

  // False when a newer request has already answered for this key (its answer stands).
  const remember = (key: string, value: Held) => {
    const now = held.get(key);
    if (now && now.seq > value.seq) return false;
    held.delete(key);
    held.set(key, value);
    while (held.size > GRANTS_HELD_MAX) {
      const oldest = held.keys().next().value as string;
      held.delete(oldest);
      clearTimeout(renewTimers.get(oldest));
      renewTimers.delete(oldest);
    }
    return true;
  };

  // The grant the page asked for before its code loaded, taken once, for the item and link it was asked for.
  const takeEarlyGrant = (itemId: string, share: ItemShare) => {
    if (typeof window === 'undefined' || !opts.bootGlobal) return null;
    const w = window as unknown as Record<string, EarlyGrant | undefined>;
    const early = w[opts.bootGlobal];
    if (!early || early.id !== itemId || early.share !== (share?.code ?? '')) return null;
    w[opts.bootGlobal] = undefined;
    return early.p;
  };

  const fetchGrant = async (itemId: string, share: ItemShare, key: string) => {
    const seq = ++requests;
    const early = takeEarlyGrant(itemId, share);
    if (early) {
      const grant = await early;
      if (grant) {
        remember(key, { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_MS, seq });
        return grant;
      }
    }
    try {
      const grant = await opts
        .client()
        .grant(itemId, share ? { code: share.code, password: share.password ?? null } : null);
      if (remember(key, { grant, until: grant.expiresAt - GRANT_RENEW_BEFORE_MS, seq })) {
        refusals.delete(key);
      }
      return grant;
    } catch (err) {
      if (
        err instanceof IndexError &&
        remember(key, { grant: null, until: Date.now() + GRANT_REFUSAL_MEMORY_MS, seq })
      ) {
        refusals.set(key, err.code);
      }
      // A network failure is not remembered: the next request asks again.
      return null;
    }
  };

  // The grant on this item, from what is held while it lasts, else one request (shared by every caller
  // meanwhile). Null when the index refuses (no access, a password needed) or cannot be reached; the api then
  // answers as it would to a caller with no grant.
  const grant = (itemId: string, share: ItemShare = null, o: { fresh?: boolean } = {}) => {
    const key = keyOf(itemId, share);
    const kept = held.get(key);
    if (!o.fresh && kept && kept.until > Date.now()) return Promise.resolve(kept.grant);
    const flight = flightOf(key, share);
    let pending = inflight.get(flight);
    if (!pending) {
      pending = fetchGrant(itemId, share, key).finally(() => inflight.delete(flight));
      inflight.set(flight, pending);
    }
    return pending;
  };

  const itemIdOfPath = (apiBase: string, url: string): string | null => {
    for (const { segment, param } of opts.queryItems ?? []) {
      if (!url.startsWith(`${apiBase}/${segment}/`)) continue;
      const query = url.split('#')[0]!.split('?')[1];
      return (query ? new URLSearchParams(query).get(param) : null) || null;
    }
    const prefix = `${apiBase}/${opts.itemsSegment}/`;
    if (!url.startsWith(prefix)) return null;
    const id = url.slice(prefix.length).split(/[/?#]/)[0];
    return id ? decodeURIComponent(id) : null;
  };

  return {
    // A grant the editor already has (the create answers one), kept as if it had been fetched.
    seed: (itemId, g, share = null) => {
      remember(keyOf(itemId, share), {
        grant: g,
        until: g.expiresAt - GRANT_RENEW_BEFORE_MS,
        seq: ++requests,
      });
    },
    grant,
    // The held grant, synchronously, while it has not lapsed: for the unload flush, which cannot wait.
    held: (itemId, share = null) => {
      const g = held.get(keyOf(itemId, share))?.grant;
      return g && g.expiresAt > Date.now() ? g.grant : null;
    },
    // Why the index last refused this item (`password_required`, `password_invalid`, `not_found`, ...), or null.
    refusal: (itemId, share = null) => refusals.get(keyOf(itemId, share)) ?? null,
    // Keep the open item's grant fresh, for as long as it stays open. Answers the stop. One timer per item, however
    // many keep it fresh: it runs until the last of them stops. A renewal the network failed is tried again after
    // GRANT_RETRY_MS; a refusal ends the renewals (the item can't be opened on this grant any more).
    keepFresh: (itemId, share = null) => {
      const key = keyOf(itemId, share);
      const keepers = (freshKeepers.get(key) ?? 0) + 1;
      freshKeepers.set(key, keepers);
      let stopped = false;
      const arm = (g: GrantResponse | null) => {
        if (!freshKeepers.has(key)) return;
        if (!g && refusals.has(key)) return;
        clearTimeout(renewTimers.get(key));
        const wait = g
          ? Math.max(1_000, g.expiresAt - GRANT_RENEW_BEFORE_MS - Date.now())
          : GRANT_RETRY_MS;
        renewTimers.set(
          key,
          setTimeout(() => void grant(itemId, share, { fresh: true }).then(arm), wait),
        );
      };
      if (keepers === 1) void grant(itemId, share).then(arm);
      return () => {
        if (stopped) return;
        stopped = true;
        const left = (freshKeepers.get(key) ?? 1) - 1;
        if (left > 0) {
          freshKeepers.set(key, left);
          return;
        }
        freshKeepers.delete(key);
        clearTimeout(renewTimers.get(key));
        renewTimers.delete(key);
      };
    },
    itemIdOfPath,
    // Adds the item's grant to a request about one item that does not carry one already, with the share code and
    // password the request names.
    withGrant: async (apiBase, input, init) => {
      const itemId = itemIdOfPath(apiBase, input);
      if (!itemId) return init;
      const headers = new Headers(init?.headers);
      if (headers.has(ITEM_GRANT_HEADER)) return init;
      const code = headers.get(SHARE_CODE_HEADER);
      const share = code ? { code, password: headers.get(SHARE_PASSWORD_HEADER) } : null;
      const g = await grant(itemId, share);
      if (!g) return init;
      headers.set(ITEM_GRANT_HEADER, g.grant);
      return { ...init, headers };
    },
    resetForTests: () => {
      held.clear();
      inflight.clear();
      refusals.clear();
      for (const timer of renewTimers.values()) clearTimeout(timer);
      renewTimers.clear();
      freshKeepers.clear();
    },
  };
}
