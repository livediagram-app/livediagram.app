// The bootstrap's two ways into a stored plan (useIdentityBootstrap.ts's `load`): a share link (`?s=<code>`) and
// the plan's own address (`/project/<id>`). Each sets what it found as the hook did inline, and answers whether the
// load reached the plan (true) or ended on a gate, a not-found or an error screen (false).
import type { Dispatch, SetStateAction } from 'react';
import type { SavedItemTypes } from '@/lib/api/item-types';
import {
  apiLoadProject,
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
import { setLoadStep } from '@/lib/load-progress';
import { isProjectTrashedError } from '@/lib/project-trashed';
import { planGrant } from '@/lib/api/plan-grants';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { resolveProjectSession } from './editor-page-helpers';
import type { CommunitySession } from './editor-realtime';
import type { makeSeedFetchedProject } from './seed-fetched-project';

type SetState<T> = Dispatch<SetStateAction<T>>;

// The setters the bootstrap writes through, grouped (a superseded run's do nothing: guardRun).
export type BootstrapSetters = {
  setActiveId: SetState<string>;
  setProjectId: SetState<string | null>;
  setProjectName: SetState<string>;
  setProjectItemTypes: SetState<SavedItemTypes>;
  setProjectNotFound: SetState<boolean>;
  setLoadError: SetState<boolean>;
  // The project is in the Trash (docs/specs/013-workspace/trash.md).
  setProjectTrashed: (trashed: boolean) => void;
  setProjectOwnerColor: SetState<string | null>;
  setProjectOwnerId: SetState<string | null>;
  setProjectOwnerName: SetState<string | null>;
  setProjectShareable: SetState<boolean>;
  setProjectTeamId: SetState<string | null>;
  setProjectServerStored: SetState<boolean>;
  setProjectShareCode: SetState<string | null>;
  setHydrated: SetState<boolean>;
  setIsOwner: SetState<boolean>;
  setLoadedExistingProject: SetState<boolean>;
  setLoadedTabIds: SetState<Set<string>>;
  setLoadingProject: SetState<boolean>;
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

type Seed = ReturnType<typeof makeSeedFetchedProject>;

// Whether the index has this plan in its Trash, for the person (the deleted card rather than not found).
async function isTrashedInIndex(id: string): Promise<boolean> {
  try {
    return (await indexClient.getItem(id)).item.trashedAt !== null;
  } catch {
    return false;
  }
}

// A share link: the code resolved (its password asked for when it has one), then the plan seeded as a visitor sees it.
export async function openShareLink({
  shareCodeParam,
  id,
  self,
  embed,
  seedFetchedProject,
  set,
}: {
  shareCodeParam: string;
  // The plan the address names too, when it does (`/project/<id>?s=<code>`).
  id: string | null;
  self: Participant;
  embed: boolean;
  seedFetchedProject: Seed;
  set: BootstrapSetters;
}): Promise<boolean> {
  const {
    setProjectId,
    setProjectNotFound,
    setLoadError,
    setProjectTrashed,
    setProjectServerStored,
    setHydrated,
    setIsOwner,
    setLoadingProject,
    setNameConfirmed,
    setSessionRole,
    setSessionShareCode,
    setSessionCommunity,
    setSessionTabScope,
    setSharePasswordGate,
    setIdentityPromptOpen,
  } = set;
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
    // "link revoked / project gone" NotFound below. Unless the link's
    // project is in the Trash (docs/specs/013-workspace/trash.md): the
    // visitor sees that it was deleted.
    if (isProjectTrashedError(err)) setProjectTrashed(true);
    else setLoadError(true);
    setHydrated(true);
    setLoadingProject(false);
    setNameConfirmed(hasConfirmedName());
    return false;
  }
  if (!resolution) {
    // The share code didn't resolve. Either it never existed,
    // the owner revoked it, or the project was deleted while
    // the visitor still had the link. Surface a NotFound page
    // so the visitor sees an explicit error instead of a
    // silent blank canvas (which used to read as "the
    // project loaded but is empty").
    setProjectNotFound(true);
    setHydrated(true);
    setLoadingProject(false);
    setNameConfirmed(hasConfirmedName());
    return false;
  }
  if ('passwordRequired' in resolution) {
    // The project is password-protected (docs/specs/013-workspace/share-password.md). Show the gate
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
    setLoadingProject(false);
    setNameConfirmed(hasConfirmedName());
    return false;
  }
  // Success path. Persist whatever password the session is
  // currently using (cached seed OR fresh user input) so the
  // next load skips the gate.
  const accepted = getSessionSharePassword();
  if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
  {
    const { project: fetched, role, tabId: scopeTabId, community } = resolution;
    const session = resolveProjectSession({
      projectOwnerId: fetched.ownerId,
      selfId: self.id,
      shareRole: role,
      shareCodeParam,
      community: community !== null,
      embed,
    });
    const codeForVisitor = session.sessionShareCode;
    // Tab seeding + name + owner fields (shared with the owner-URL
    // branch below): see seed-fetched-project.ts. Visitors present
    // their session share code on the eager first-tab fetch.
    // Scope first: seeding makes the scoped tab active, and the active-tab
    // guard refuses any other (docs/specs/013-workspace/tab-scoped-share-links.md).
    setSessionTabScope(scopeTabId);
    setLoadStep('first-tab');
    await seedFetchedProject(self.id, fetched, codeForVisitor, scopeTabId);
    // A share link always opens a server project: it has a room.
    setProjectServerStored(true);
    setProjectId(fetched.id);
    // A link's own address (`/project/shared?s=<code>`) names no plan: the bar names the one it opened, so a
    // reload, a deep link and the grant all address the plan itself.
    if (!id) {
      window.history.replaceState(
        window.history.state,
        '',
        `/project/${encodeURIComponent(fetched.id)}${window.location.search}${window.location.hash}`,
      );
    }
    setIsOwner(session.isOwner);
    // Visitors inherit the role from their share code; owners are
    // always 'edit' (see resolveProjectSession).
    setSessionRole(session.sessionRole);
    // Visitor: stash the code they came in on so any log
    // writes can present it as authorisation. Owner accessing
    // via a share URL keeps null.
    setSessionShareCode(session.sessionShareCode);
    // A Community post's link (docs/specs/025-community/community.md "Viewing a post's plan"): no room, no
    // name prompt, not added to Shared with you. The author too opens it read-only (resolveProjectSession),
    // with a way to their own plan.
    const viaCommunity = community !== null;
    setSessionCommunity(
      community
        ? { ...community, ownProjectId: fetched.ownerId === self.id ? fetched.id : null }
        : null,
    );
    // Signed-in user opening their own project via a share URL
    // already has a confirmed identity: never prompt. Visitors
    // (signed in or not) still see the welcome card so they get
    // the "you're joining X's project" context; the name input
    // is locked downstream when they have an account identity so
    // they can't pretend to be someone else.
    const isOwnerVisit = session.isOwner;
    if (!isOwnerVisit && !viaCommunity && !hasConfirmedName()) {
      setIdentityPromptOpen(true);
    }
    // Project·Joined is counted by the api worker when it resolves
    // the share code, once per (visitor, project) (docs/specs/017-telemetry/telemetry.md). Emitting
    // here counted every refresh and return visit.
  }
  return true;
}

// The plan's own address: the plan fetched for this person, then seeded as its owner (or a team member) sees it.
export async function openOwnAddress({
  id,
  self,
  early,
  accountUserId,
  seedFetchedProject,
  set,
}: {
  id: string;
  self: Participant;
  // An early open (a plan in This Browser before auth settled): the naming nudge waits for auth.
  early: boolean;
  accountUserId: string | null | undefined;
  seedFetchedProject: Seed;
  set: BootstrapSetters;
}): Promise<boolean> {
  const {
    setProjectId,
    setProjectNotFound,
    setLoadError,
    setProjectTrashed,
    setProjectServerStored,
    setHydrated,
    setIsOwner,
    setLoadingProject,
    setNameConfirmed,
    setSessionRole,
    setIdentityPromptOpen,
  } = set;
  setLoadStep('project');
  let fetched;
  try {
    fetched = await apiLoadProject(self.id, id);
  } catch (err) {
    // The load FAILED (network down / 5xx): not a clean 404.
    // Surface a retryable error page rather than NotFound, which
    // would wrongly tell the user the project doesn't exist. A project
    // in the Trash (docs/specs/013-workspace/trash.md) is neither: it
    // gets the deleted card.
    setProjectId(id);
    if (isProjectTrashedError(err)) setProjectTrashed(true);
    else setLoadError(true);
    setHydrated(true);
    setLoadingProject(false);
    setNameConfirmed(hasConfirmedName());
    return false;
  }
  if (!fetched) {
    // URL had a ?d=<id> but the API didn't return anything for
    // us: either the project doesn't exist or we don't own it.
    // Surface a NotFound page instead of dropping the user into
    // the new-project welcome flow. A plan in the Trash has no grant, so the api cannot tell it from a
    // missing one; the index can (its item outlives the trashing), and then it gets the deleted card.
    setProjectId(id);
    if (await isTrashedInIndex(id)) setProjectTrashed(true);
    else setProjectNotFound(true);
    setHydrated(true);
    setLoadingProject(false);
    setNameConfirmed(hasConfirmedName());
    return false;
  }
  // Past the `!fetched` return above, so the project is loaded.
  // Tab seeding + name + owner fields (shared with the visitor
  // branch above): see seed-fetched-project.ts. The owner's
  // eager first-tab fetch presents no share code.
  setLoadStep('first-tab');
  await seedFetchedProject(self.id, fetched, null, null);
  // An offline project (docs/specs/006-project/offline-mode.md) is yours by construction: its
  // ownerId is the local sentinel, never a participant id, so
  // without this it would wrongly get visitor chrome (Make a
  // copy, the owner badge row).
  const offline = fetched.ownerId === OFFLINE_OWNER_ID;
  // Every server-stored project has a room, personal ones included (docs/specs/024-agents/
  // agent-changesets.md "Rooms for personal projects"); an offline one has none.
  setProjectServerStored(!offline);
  // The owner's chrome goes to whoever holds edit on the plan without a link: its owner, or a member of the
  // team that owns it. The index decides that, so a guest's plans stay theirs once the guest becomes an account.
  setIsOwner(offline || (await planGrant(fetched.id))?.level === 'edit');
  setSessionRole('edit');
  // Owner branch (`?d=<id>` / `/project/<id>`): a signed-in
  // user is by definition the owner here and their identity is
  // settled: skip the identity prompt entirely. Guests fall
  // back to the legacy localStorage gate so they still get the
  // one-time naming nudge.
  if (!early && !accountUserId && !hasConfirmedName()) {
    setIdentityPromptOpen(true);
  }
  setProjectId(id);
  return true;
}
