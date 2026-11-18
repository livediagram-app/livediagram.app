// The identity bootstrap's two ways into a stored item (each editor's useIdentityBootstrap, its `load`): a share
// link (`?s=<code>`) and the item's own address (`/<route>/<id>`). Every editor arrives the same way; its own nouns
// come in through an ArrivalProduct (its loaders, share-password store, session kernel and load steps) and an
// ArrivalSetters (its state setters, already guarded by the run: a superseded run's writes do nothing). Each
// arrival sets what it found, in the order the editors always did, and answers whether the load reached the item
// (true) or ended on a gate, a not-found or an error screen (false). The specs, in each product's docs/specs:
// 013-workspace/share-password.md, trash.md, tab-scoped-share-links.md and 025-community/community.md.
import { parseStoredLevel, type AccessLevel } from '@liveworkspace/api-schema/access-levels';
import { isArchivedLoadError } from './archived';
import { indexClient } from './index-client';
import type { LastSeenDoors, LastSeenFirstTab, LastSeenInput } from './api/last-seen-copies';

/** What a load answers for an item: enough to tell its owner and to address it. */
export type ArrivalItem = { id: string; ownerId: string };

/** A share code resolved: the gate (`passwordRequired`), or the item with the level and tab the link grants. */
export type ArrivalResolution<Item, Role, Post> =
  | { passwordRequired: true; invalid: boolean }
  | { item: Item; role: Role; tabId: string | null; community: Post | null };

/** Who the reader is for this item (the product's tested session kernel answers it). */
export type ArrivalSession<Role> = {
  isOwner: boolean;
  sessionRole: Role;
  sessionShareCode: string | null;
};

/** A product's side of the arrival: what it loads with and how it names its steps. */
export type ArrivalProduct<
  Item extends ArrivalItem,
  Role,
  Post,
  Community,
  OwnStep extends string,
> = {
  // Resolve a share code; `id` is the item the address names too, when it does.
  loadShared: (
    code: string,
    selfId: string,
    id: string | null,
  ) => Promise<ArrivalResolution<Item, Role, Post> | null>;
  // The item for its own address, or null when it does not exist or is not this person's.
  loadOwn: (selfId: string, id: string) => Promise<Item | null>;
  // The load step (docs/specs/007-editor/load-recovery.md) the own address reports.
  ownStep: OwnStep;
  setLoadStep: (step: 'share' | 'first-tab' | OwnStep) => void;
  sharePassword: {
    readCached: (code: string) => string | null;
    writeCached: (code: string, password: string | null) => void;
    getSession: () => string | null;
    setSession: (password: string | null) => void;
  };
  hasConfirmedName: () => boolean;
  isTrashedError: (err: unknown) => boolean;
  resolveSession: (input: {
    ownerId: string;
    selfId: string;
    shareRole: Role;
    shareCodeParam: string;
    community: boolean;
    embed: boolean;
  }) => ArrivalSession<Role>;
  // The Community session a post's link opens, with the author's own item when the reader is its author.
  communitySession: (post: Post, ownItemId: string | null) => Community;
  // The person's grant on the item: edit on it without a link is the owner's chrome. `link` (the code a link's access
  // came through) and `tabId` say who a visitor reopening the item by its own address is.
  grant: (id: string) => Promise<{ level: string; tabId?: string | null; link?: string } | null>;
  // The local sentinel an Offline Mode item is owned by.
  offlineOwnerId: string;
  // A link's own address names no item: the address to put in the bar for the one it opened, or null to keep it.
  // Left out, the bar keeps the link's address.
  sharedAddress?: (itemId: string) => string | null;
  // The last seen copy (the product's offline-mode.md "Warm open of a cloud document"): kept when a load reaches the
  // item, forgotten when the reader lost it. Left out, no copy is kept.
  lastSeen?: LastSeenDoors<Item>;
};

/** The setters an arrival writes through, under neutral names. */
export type ArrivalSetters<Role, Community> = {
  setItemId: (id: string) => void;
  setNotFound: (notFound: boolean) => void;
  setLoadError: (failed: boolean) => void;
  // The item is in the Trash (docs/specs/013-workspace/trash.md).
  setTrashed: (trashed: boolean) => void;
  setServerStored: (stored: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  setIsOwner: (owner: boolean) => void;
  setLoading: (loading: boolean) => void;
  setNameConfirmed: (confirmed: boolean) => void;
  // An owner's or team member's own address is 'edit'; a visitor's is the level their grant names.
  setSessionRole: (role: Role | AccessLevel) => void;
  setSessionShareCode: (code: string | null) => void;
  setSessionCommunity: (community: Community | null) => void;
  // The one tab a tab-scoped link opens (docs/specs/013-workspace/tab-scoped-share-links.md); null = all.
  setSessionTabScope: (scope: string | null) => void;
  // `changed`: the refused password was the one this browser remembered, so the owner changed it.
  setSharePasswordGate: (gate: { invalid: boolean; changed?: boolean }) => void;
  setIdentityPromptOpen: (open: boolean) => void;
};

/** One run's side: who is reading, its seed (tab seeding, name and owner fields) and its guarded setters. The seed
 *  may answer the first tab it painted, for the last seen copy. */
export type ArrivalRun<Item, Role, Community> = {
  self: { id: string };
  seed: (
    selfId: string,
    item: Item,
    shareCode: string | null,
    scopeTabId: string | null,
  ) => Promise<void | LastSeenFirstTab<unknown> | null>;
  set: ArrivalSetters<Role, Community>;
};

/** Whether the index has this item in its Trash, for the person; false when it cannot say. */
export async function isTrashedInIndex(id: string): Promise<boolean> {
  try {
    return (await indexClient.getItem(id)).item.trashedAt !== null;
  } catch {
    return false;
  }
}

// The last seen copy's doors, started and never awaited: the store answers on its own time and never holds the load.
function keepCopy<Item>(
  doors: LastSeenDoors<Item> | undefined,
  copy: LastSeenInput<Item, unknown>,
) {
  void doors?.remember(copy).catch(() => {});
}
// The reader lost the item the address names: its copy goes. A share link's copies go by its code too, since its own
// address (`/<route>/shared?s=<code>`) names no item.
function forgetCopy<Item>(
  doors: LastSeenDoors<Item> | undefined,
  reader: string,
  id: string | null,
  via: string | null = null,
) {
  if (id) void doors?.forget(reader, id).catch(() => {});
  if (via) void doors?.forgetVia?.(reader, via).catch(() => {});
}

// A load that ended short of the item: the screen is up, the opening screen goes.
function endShort(
  product: { hasConfirmedName: () => boolean },
  set: Pick<ArrivalSetters<unknown, unknown>, 'setHydrated' | 'setLoading' | 'setNameConfirmed'>,
): false {
  set.setHydrated(true);
  set.setLoading(false);
  set.setNameConfirmed(product.hasConfirmedName());
  return false;
}

/** A share link: the code resolved (its password asked for when it has one), then the item seeded as a visitor sees it. */
export async function openShareLink<
  Item extends ArrivalItem,
  Role,
  Post,
  Community,
  OwnStep extends string,
>(
  product: ArrivalProduct<Item, Role, Post, Community, OwnStep>,
  run: ArrivalRun<Item, Role, Community>,
  // `id`: the item the address names too, when it does (`/<route>/<id>?s=<code>`).
  link: { shareCodeParam: string; id: string | null; embed: boolean },
): Promise<boolean> {
  const { shareCodeParam, id, embed } = link;
  const { self, seed, set } = run;
  const password = product.sharePassword;
  // Warm-cache the share password (docs/specs/013-workspace/share-password.md) before the first call so a
  // returning visitor whose password didn't change gets straight to the canvas without the gate. The seed is a
  // no-op when the cache is empty (the api headers see null and skip X-Share-Password), and if the server
  // rejects the cached value the entry is cleared below.
  const cachedPassword = password.readCached(shareCodeParam);
  if (cachedPassword) password.setSession(cachedPassword);
  // The visitor's owner id rides the resolve, so the visit is recorded (their Shared With Me).
  product.setLoadStep('share');
  let resolution;
  try {
    resolution = await product.loadShared(shareCodeParam, self.id, id);
  } catch (err) {
    // Couldn't reach the server to resolve the share link (network / 5xx). Retryable, so show the error page
    // instead of the "link revoked / item gone" NotFound below. Unless the link's item is in the Trash
    // (docs/specs/013-workspace/trash.md): the visitor sees that it was deleted.
    if (product.isTrashedError(err)) {
      set.setTrashed(true);
      forgetCopy(product.lastSeen, self.id, id, shareCodeParam);
    } else set.setLoadError(true);
    return endShort(product, set);
  }
  if (!resolution) {
    // The share code didn't resolve: it never existed, the owner revoked it, or the item was deleted while the
    // visitor still had the link. A NotFound page, so the visitor sees an explicit error instead of a silent blank
    // canvas (which used to read as "it loaded but is empty").
    set.setNotFound(true);
    forgetCopy(product.lastSeen, self.id, id, shareCodeParam);
    return endShort(product, set);
  }
  if ('passwordRequired' in resolution) {
    // The item is password-protected (docs/specs/013-workspace/share-password.md). Show the gate instead of
    // hydrating. Deliberately leave `hydrated` false so bumping `passwordRetry` (on submit) re-runs the bootstrap
    // with the password now set on the session. `invalid` marks a wrong attempt so the gate can show an error. A
    // cached password the server just rejected goes from both buckets: cleared so the same wrong value doesn't
    // loop on the next retry, and the session attempt reset too so the gate's empty input isn't lying about what
    // is about to be sent.
    if (cachedPassword) {
      password.writeCached(shareCodeParam, null);
      password.setSession(null);
    }
    // A copy never shows behind the gate.
    forgetCopy(product.lastSeen, self.id, id, shareCodeParam);
    // A remembered password the index refused is not the visitor's mistake: the owner changed it. The gate says so,
    // with no mismatch line; only a password the visitor typed is "didn't match" (share-password.md).
    const changed = resolution.invalid && cachedPassword !== null;
    set.setSharePasswordGate(
      changed ? { invalid: false, changed: true } : { invalid: resolution.invalid },
    );
    set.setLoading(false);
    set.setNameConfirmed(product.hasConfirmedName());
    return false;
  }
  // Success. Persist whatever password the session is using (cached seed or fresh input) so the next load skips
  // the gate.
  const accepted = password.getSession();
  if (accepted) password.writeCached(shareCodeParam, accepted);
  const { item: fetched, role, tabId: scopeTabId, community } = resolution;
  const session = product.resolveSession({
    ownerId: fetched.ownerId,
    selfId: self.id,
    shareRole: role,
    shareCodeParam,
    community: community !== null,
    embed,
  });
  // Tab seeding, name and owner fields (shared with the own address below). Visitors present their session share
  // code on the eager first-tab fetch. Scope first: seeding makes the scoped tab active, and the active-tab guard
  // refuses any other (docs/specs/013-workspace/tab-scoped-share-links.md).
  set.setSessionTabScope(scopeTabId);
  product.setLoadStep('first-tab');
  const firstTab = await seed(self.id, fetched, session.sessionShareCode, scopeTabId);
  // A share link always opens a server item: it has a room.
  set.setServerStored(true);
  set.setItemId(fetched.id);
  // A link's own address (`/<route>/shared?s=<code>`) names no item: the bar names the one it opened, so a
  // reload, a deep link and the grant all address the item itself.
  const address = !id && product.sharedAddress ? product.sharedAddress(fetched.id) : null;
  if (address) {
    window.history.replaceState(
      window.history.state,
      '',
      `${address}${window.location.search}${window.location.hash}`,
    );
  }
  set.setIsOwner(session.isOwner);
  // Visitors inherit the role from their share code; owners are always 'edit' (the session kernel).
  set.setSessionRole(session.sessionRole);
  // A visitor keeps the code they came in on, so their writes can present it as authorisation. An owner opening
  // a share URL keeps null.
  set.setSessionShareCode(session.sessionShareCode);
  // A Community post's link (docs/specs/025-community/community.md): no room, no name prompt, not added to Shared
  // with you. The author too opens it read-only (the session kernel), with a way to their own item.
  set.setSessionCommunity(
    community
      ? product.communitySession(community, fetched.ownerId === self.id ? fetched.id : null)
      : null,
  );
  // A signed-in owner opening their own item through a share URL has a confirmed identity: never prompt. Visitors
  // (signed in or not) still see the welcome card for the "you're joining X's" context; the name input is locked
  // downstream when they have an account identity, so they can't pretend to be someone else.
  if (!session.isOwner && community === null && !product.hasConfirmedName()) {
    set.setIdentityPromptOpen(true);
  }
  // A Community post and an embed are read-only views opened from elsewhere: they keep no copy.
  if (community === null && !embed) {
    keepCopy(product.lastSeen, {
      reader: self.id,
      itemId: fetched.id,
      item: fetched,
      firstTab: firstTab ?? null,
      via: shareCodeParam,
      access: {
        role: String(session.sessionRole),
        isOwner: session.isOwner,
        sessionShareCode: session.sessionShareCode,
        tabScope: scopeTabId,
      },
    });
  }
  // Joined is counted by the api worker when it resolves the share code, once per (visitor, item)
  // (docs/specs/017-telemetry/telemetry.md). Emitting here counted every refresh and return visit.
  return true;
}

/** Who the person reading an item by its own address is, from their grant. */
type OwnReader = {
  isOwner: boolean;
  role: AccessLevel;
  // Opened at a link's level: the session carries its code and tab, as a share link's would.
  visitor: boolean;
  shareCode: string | null;
  tabScope: string | null;
};

const OWN_READER: OwnReader = {
  isOwner: true,
  role: 'edit',
  visitor: false,
  shareCode: null,
  tabScope: null,
};

/** The index's grant decides who reads an item by its own address (liveworkspace one-explorer-contracts.md "Sharing
 *  and access"). Edit with no link is its owner's or a team member's. A link the person opened before (Shared with
 *  me) still admits them with no code sent, and the grant names it: they open as that link's visitor, at its level,
 *  on its tab, carrying its code, never as Editing for saves the api would refuse. No grant (the index out of reach)
 *  keeps edit without the owner's chrome; the api and the room still refuse what no grant allows. */
export function readerOfGrant(
  grant: { level: string; tabId?: string | null; link?: string } | null,
): OwnReader {
  if (!grant) return { ...OWN_READER, isOwner: false };
  const role = parseStoredLevel(grant.level);
  if (role === 'edit' && !grant.link) return OWN_READER;
  return {
    isOwner: false,
    role,
    visitor: true,
    shareCode: grant.link ?? null,
    tabScope: grant.tabId ?? null,
  };
}

/** The item's own address: the item fetched for this person, then seeded as its owner (or a team member) sees it. */
export async function openOwnAddress<
  Item extends ArrivalItem,
  Role,
  Post,
  Community,
  OwnStep extends string,
>(
  product: ArrivalProduct<Item, Role, Post, Community, OwnStep>,
  run: ArrivalRun<Item, Role, Community>,
  // `early`: an early open (an item in This Browser before auth settled), whose naming nudge waits for auth.
  own: { id: string; early: boolean; accountUserId: string | null | undefined },
): Promise<boolean> {
  const { id, early, accountUserId } = own;
  const { self, seed, set } = run;
  product.setLoadStep(product.ownStep);
  let fetched;
  try {
    fetched = await product.loadOwn(self.id, id);
  } catch (err) {
    // The load FAILED (network down / 5xx): not a clean 404. A retryable error page rather than NotFound, which
    // would wrongly say the item doesn't exist. An item in the Trash (docs/specs/013-workspace/trash.md) is
    // neither: it gets the deleted card.
    set.setItemId(id);
    if (product.isTrashedError(err)) {
      set.setTrashed(true);
      forgetCopy(product.lastSeen, self.id, id);
    } else if (isArchivedLoadError(err)) {
      // Archived by its owner (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): the api relays the
      // index's `409 archived`, which only the owner hears. Not a connection problem: the item ends on not found,
      // which the editor shows as its archived card (the held grant's refusal says archived).
      set.setNotFound(true);
    } else set.setLoadError(true);
    return endShort(product, set);
  }
  if (!fetched) {
    // The address named an item the api returned nothing for: it doesn't exist or isn't ours. A NotFound page
    // instead of the new-item welcome flow. An item in the Trash has no grant, so the api cannot tell it from a
    // missing one; the index can (its item outlives the trashing), and then it gets the deleted card.
    set.setItemId(id);
    if (await isTrashedInIndex(id)) set.setTrashed(true);
    else set.setNotFound(true);
    forgetCopy(product.lastSeen, self.id, id);
    return endShort(product, set);
  }
  // An offline item (the product's offline-mode.md) is yours by construction: its ownerId is the local
  // sentinel, never a participant id, so without this it would wrongly get visitor chrome (Make a copy, the owner
  // badge row).
  const offline = fetched.ownerId === product.offlineOwnerId;
  const reader = offline ? OWN_READER : readerOfGrant(await product.grant(fetched.id));
  // Tab seeding, name and owner fields (shared with the share link above). The owner's eager first-tab fetch
  // presents no share code; a visitor's presents their link's, and its scope comes first, as on a share link.
  if (reader.visitor) set.setSessionTabScope(reader.tabScope);
  product.setLoadStep('first-tab');
  const firstTab = await seed(self.id, fetched, reader.shareCode, reader.tabScope);
  // Every server-stored item has a room, personal ones included (docs/specs/024-agents/agent-changesets.md);
  // an offline one has none.
  set.setServerStored(!offline);
  set.setIsOwner(reader.isOwner);
  set.setSessionRole(reader.role);
  if (reader.visitor) set.setSessionShareCode(reader.shareCode);
  // The own address: a signed-in user is the owner here and their identity is settled, so no identity prompt.
  // Guests fall back to the local gate so they still get the one-time naming nudge.
  if (!early && !accountUserId && !product.hasConfirmedName()) {
    set.setIdentityPromptOpen(true);
  }
  set.setItemId(id);
  // This Browser's items open from this browser already: only a server item keeps a copy.
  if (!offline) {
    keepCopy(product.lastSeen, {
      reader: self.id,
      itemId: id,
      item: fetched,
      firstTab: firstTab ?? null,
      via: reader.shareCode,
      access: {
        role: reader.role,
        isOwner: reader.isOwner,
        sessionShareCode: reader.shareCode,
        tabScope: reader.tabScope,
      },
    });
  }
  return true;
}
