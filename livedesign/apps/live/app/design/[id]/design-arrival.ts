// A design's arrival for the identity bootstrap (useIdentityBootstrap): the share link's branch and the owner URL's,
// each ending the load itself when it stops short (the password gate, an error, not found), plus the run guard
// that drops a superseded run's writes. Moved out of useIdentityBootstrap.ts as they were.
import type { Dispatch, SetStateAction } from 'react';
import {
  apiLoadDesign,
  apiLoadShared,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
  type ShareRole,
} from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { Participant } from '@/lib/identity';
import { hasConfirmedName } from '@/lib/local-identity';
import { resolveDesignSession } from './editor-page-helpers';
import type { CommunitySession } from './editor-realtime';
import type { makeSeedFetchedDesign } from './seed-fetched-design';
import { isDesignTrashedError } from '@/lib/design-trashed';
import { designGrant } from '@/lib/api/design-grants';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { setLoadStep } from '@/lib/load-progress';

type SeedFetchedDesign = ReturnType<typeof makeSeedFetchedDesign>;

type SetState<T> = Dispatch<SetStateAction<T>>;

// The setters the bootstrap writes, each one guarded by its run (guardRun).
export type BootstrapSet = {
  setActiveId: SetState<string>;
  setDesignId: SetState<string | null>;
  setDesignName: SetState<string>;
  setDesignNotFound: SetState<boolean>;
  setLoadError: SetState<boolean>;
  // The design is in the Trash (docs/specs/013-workspace/trash.md).
  setDesignTrashed: (trashed: boolean) => void;
  setDesignOwnerColor: SetState<string | null>;
  setDesignOwnerId: SetState<string | null>;
  setDesignOwnerName: SetState<string | null>;
  setDesignShareable: SetState<boolean>;
  setDesignTeamId: SetState<string | null>;
  setDesignServerStored: SetState<boolean>;
  setDesignShareCode: SetState<string | null>;
  setHydrated: SetState<boolean>;
  setIsOwner: SetState<boolean>;
  setLoadedExistingDesign: SetState<boolean>;
  setLoadedTabIds: SetState<Set<string>>;
  setLoadingDesign: SetState<boolean>;
  setNameConfirmed: SetState<boolean>;
  setSelfParticipant: SetState<Participant>;
  setSessionRole: SetState<ShareRole>;
  setSessionShareCode: SetState<string | null>;
  // The Community post a community link opened (docs/specs/025-community/community.md).
  setSessionCommunity: SetState<CommunitySession | null>;
  // The one tab a tab-scoped link opens (docs/specs/013-workspace/tab-scoped-share-links.md); null = all.
  setSessionTabScope: (scope: string | null) => void;
  setSharePasswordGate: SetState<{ invalid: boolean } | null>;
  setIdentityPromptOpen: SetState<boolean>;
};

const isCallable = (v: unknown): v is (...args: unknown[]) => unknown => typeof v === 'function';

// Every function of `fns`, doing nothing once `live` says its run was superseded.
export function guardRun<T extends object>(fns: T, live: () => boolean): T {
  return new Proxy(fns, {
    get: (target, name) => {
      const fn: unknown = Reflect.get(target, name);
      return isCallable(fn) ? (...args: unknown[]) => (live() ? fn(...args) : undefined) : fn;
    },
  });
}

// Whether the index has this design in its Trash, for the person (the deleted card rather than not found).
async function isTrashedInIndex(id: string): Promise<boolean> {
  try {
    return (await indexClient.getItem(id)).item.trashedAt !== null;
  } catch {
    return false;
  }
}

// What an arrival reads: the address, who is reading, and the run's guarded setters and seed.
export type ArrivalContext = {
  id: string | null;
  self: Participant;
  early: boolean;
  embed: boolean;
  accountUserId: string | null | undefined;
  set: BootstrapSet;
  seedFetchedDesign: SeedFetchedDesign;
};

// A share link's arrival (`?s=<code>`): the visitor's design through the share-code endpoint, behind its password
// when it has one. True when the load ended here (the gate, an error, not found), so the bootstrap stops.
export async function openSharedDesign(
  shareCodeParam: string,
  ctx: ArrivalContext,
): Promise<boolean> {
  const { id, self, embed, seedFetchedDesign } = ctx;
  const {
    setDesignId,
    setDesignNotFound,
    setLoadError,
    setDesignTrashed,
    setDesignServerStored,
    setHydrated,
    setIsOwner,
    setLoadingDesign,
    setNameConfirmed,
    setSessionRole,
    setSessionShareCode,
    setSessionCommunity,
    setSessionTabScope,
    setSharePasswordGate,
    setIdentityPromptOpen,
  } = ctx.set;
  // Warm-cache the share password (docs/specs/013-workspace/share-password.md) before the first
  // call so a returning visitor whose password didn't change
  // gets straight to the canvas without the gate. The seed is
  // a no-op when the cache is empty (apiHeaders sees null and
  // skips the X-Share-Password header), and if the server
  // rejects the cached value we'll clear the entry below.
  const cachedPassword = readCachedSharePassword(shareCodeParam);
  if (cachedPassword) setSessionSharePassword(cachedPassword);
  // Pass the visitor's owner id so the api worker can record
  // their visit into shared_with: without it the server can't
  // identify the visitor and the "Shared with you" list stays
  // empty forever.
  setLoadStep('share');
  let resolution;
  try {
    resolution = await apiLoadShared(shareCodeParam, self.id, id);
  } catch (err) {
    // Couldn't reach the server to resolve the share link (network
    // / 5xx). Retryable, so show the error page instead of the
    // "link revoked / design gone" NotFound below. Unless the link's
    // design is in the Trash (docs/specs/013-workspace/trash.md): the
    // visitor sees that it was deleted.
    if (isDesignTrashedError(err)) setDesignTrashed(true);
    else setLoadError(true);
    setHydrated(true);
    setLoadingDesign(false);
    setNameConfirmed(hasConfirmedName());
    return true;
  }
  if (!resolution) {
    // The share code didn't resolve. Either it never existed,
    // the owner revoked it, or the design was deleted while
    // the visitor still had the link. Surface a NotFound page
    // so the visitor sees an explicit error instead of a
    // silent blank canvas (which used to read as "the
    // design loaded but is empty").
    setDesignNotFound(true);
    setHydrated(true);
    setLoadingDesign(false);
    setNameConfirmed(hasConfirmedName());
    return true;
  }
  if ('passwordRequired' in resolution) {
    // The design is password-protected (docs/specs/013-workspace/share-password.md). Show the gate
    // instead of hydrating. Deliberately leave `hydrated` false
    // so bumping `passwordRetry` (on submit) re-runs this effect
    // with the password now set on the session. `invalid` marks
    // a wrong attempt so the gate can show an error. A cached
    // password that the server just rejected goes into both
    // buckets: clear it so we don't loop the same wrong value
    // on the next retry, and reset the session attempt too so
    // the gate's empty-input prompt isn't lying about what's
    // about to be sent.
    if (cachedPassword) {
      writeCachedSharePassword(shareCodeParam, null);
      setSessionSharePassword(null);
    }
    setSharePasswordGate({ invalid: resolution.invalid });
    setLoadingDesign(false);
    setNameConfirmed(hasConfirmedName());
    return true;
  }
  // Success path. Persist whatever password the session is
  // currently using (cached seed OR fresh user input) so the
  // next load skips the gate.
  const accepted = getSessionSharePassword();
  if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
  {
    const { design: fetched, role, tabId: scopeTabId, community } = resolution;
    const session = resolveDesignSession({
      designOwnerId: fetched.ownerId,
      selfId: self.id,
      shareRole: role,
      shareCodeParam,
      community: community !== null,
      embed,
    });
    const codeForVisitor = session.sessionShareCode;
    // Tab seeding + name + owner fields (shared with the owner-URL
    // branch below), see seed-fetched-design.ts. Visitors present
    // their session share code on the eager first-tab fetch.
    // Scope first: seeding makes the scoped tab active, and the active-tab
    // guard refuses any other (docs/specs/013-workspace/tab-scoped-share-links.md).
    setSessionTabScope(scopeTabId);
    setLoadStep('first-tab');
    await seedFetchedDesign(self.id, fetched, codeForVisitor, scopeTabId);
    // A share link always opens a server design: it has a room.
    setDesignServerStored(true);
    setDesignId(fetched.id);
    // A link's own address (`/design/shared?s=<code>`) names no design: the bar names the one it opened, so a
    // reload, a deep link and the grant all address the design itself.
    if (!id) {
      window.history.replaceState(
        window.history.state,
        '',
        `/design/${encodeURIComponent(fetched.id)}${window.location.search}${window.location.hash}`,
      );
    }
    setIsOwner(session.isOwner);
    // Visitors inherit the role from their share code; owners are
    // always 'edit' (see resolveDesignSession).
    setSessionRole(session.sessionRole);
    // Visitor: stash the code they came in on so any log
    // writes can present it as authorisation. Owner accessing
    // via a share URL keeps null.
    setSessionShareCode(session.sessionShareCode);
    // A Community post's link (docs/specs/025-community/community.md "Viewing a post's
    // design"): no room, no name prompt, not added to Shared with you.
    // The author too opens it read-only (resolveDesignSession), with a way to their own design.
    const viaCommunity = community !== null;
    setSessionCommunity(
      community
        ? { ...community, ownDesignId: fetched.ownerId === self.id ? fetched.id : null }
        : null,
    );
    // Signed-in user opening their own design via a share URL
    // already has a confirmed identity, never prompt. Visitors
    // (signed in or not) still see the welcome card so they get
    // the "you're joining X's design" context; the name input
    // is locked downstream when they have an account identity so
    // they can't pretend to be someone else.
    const isOwnerVisit = session.isOwner;
    if (!isOwnerVisit && !viaCommunity && !hasConfirmedName()) {
      setIdentityPromptOpen(true);
    }
    // Document·Joined is counted by the api worker when it resolves
    // the share code, once per (visitor, design) (docs/specs/017-telemetry/telemetry.md). Emitting
    // here counted every refresh and return visit.
  }
  return false;
}

// The owner URL's arrival (`/design/<id>`): the design itself, or the deleted card or not found. True when the load
// ended here, so the bootstrap stops.
export async function openOwnDesign(id: string, ctx: ArrivalContext): Promise<boolean> {
  const { self, early, accountUserId, seedFetchedDesign } = ctx;
  const {
    setDesignId,
    setDesignNotFound,
    setLoadError,
    setDesignTrashed,
    setDesignServerStored,
    setHydrated,
    setIsOwner,
    setLoadingDesign,
    setNameConfirmed,
    setSessionRole,
    setIdentityPromptOpen,
  } = ctx.set;
  setLoadStep('design');
  let fetched;
  try {
    fetched = await apiLoadDesign(self.id, id);
  } catch (err) {
    // The load FAILED (network down / 5xx), not a clean 404.
    // Surface a retryable error page rather than NotFound, which
    // would wrongly tell the user the design doesn't exist. A design
    // in the Trash (docs/specs/013-workspace/trash.md) is neither: it
    // gets the deleted card.
    setDesignId(id);
    if (isDesignTrashedError(err)) setDesignTrashed(true);
    else setLoadError(true);
    setHydrated(true);
    setLoadingDesign(false);
    setNameConfirmed(hasConfirmedName());
    return true;
  }
  if (!fetched) {
    // URL had a ?d=<id> but the API didn't return anything for
    // us: either the design doesn't exist or we don't own it.
    // Surface a NotFound page instead of dropping the user into
    // the new-design welcome flow. A design in the Trash has no grant, so the api cannot tell it from a
    // missing one; the index can (its item outlives the trashing), and then it gets the deleted card.
    setDesignId(id);
    if (await isTrashedInIndex(id)) setDesignTrashed(true);
    else setDesignNotFound(true);
    setHydrated(true);
    setLoadingDesign(false);
    setNameConfirmed(hasConfirmedName());
    return true;
  }
  // Past the `!fetched` return above, so the design is loaded.
  // Tab seeding + name + owner fields (shared with the visitor
  // branch above), see seed-fetched-design.ts. The owner's
  // eager first-tab fetch presents no share code.
  setLoadStep('first-tab');
  await seedFetchedDesign(self.id, fetched, null, null);
  // An offline design (docs/specs/006-design/offline-mode.md) is yours by construction: its
  // ownerId is the local sentinel, never a participant id, so
  // without this it would wrongly get visitor chrome (Make a
  // copy, the owner badge row).
  const offline = fetched.ownerId === OFFLINE_OWNER_ID;
  // Every server-stored design has a room, personal ones included (docs/specs/024-agents/
  // agent-changesets.md "Rooms for personal designs"); an offline one has none.
  setDesignServerStored(!offline);
  // The owner's chrome goes to whoever holds edit on the design without a link: its owner, or a member of the
  // team that owns it. The index decides that, so a guest's designs stay theirs once the guest becomes an account.
  setIsOwner(offline || (await designGrant(fetched.id))?.level === 'edit');
  setSessionRole('edit');
  // Owner branch (`?d=<id>` / `/design/<id>`): a signed-in
  // user is by definition the owner here and their identity is
  // settled: skip the identity prompt entirely. Guests fall
  // back to the legacy localStorage gate so they still get the
  // one-time naming nudge.
  if (!early && !accountUserId && !hasConfirmedName()) {
    setIdentityPromptOpen(true);
  }
  setDesignId(id);
  return false;
}
