import type { SavedItemTypes } from '@/lib/api/item-types';
import {
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffectEvent,
} from 'react';
import { projectIdFromPath, isEditorPath } from '@/lib/legacy-editor-path';
import type { Tab } from '@liveplanner/project';
import {
  apiListShareLinks,
  apiLoadProject,
  apiLoadShared,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
  type ShareLink,
  type SharedWithItem,
  type ShareRole,
} from '@/lib/api-client';
import { isOfflineId, OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { debugLog } from '@/lib/debug-log';
import { resolveParticipant } from './resolve-participant';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { resolveProjectSession } from './editor-page-helpers';
import { makeSeedFetchedProject } from './seed-fetched-project';
import { isProjectTrashedError } from '@/lib/project-trashed';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { projectLoadOrigin, noteProjectLoadEnded, startEditorTiming } from '@/lib/timing';
import { errorNameToken, errorTypeToken } from '@liveplanner/api-schema';
import type { WorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import { loadWorkbenchProject } from './workbench-bootstrap';

type SetState<T> = Dispatch<SetStateAction<T>>;

const isCallable = (v: unknown): v is (...args: unknown[]) => unknown => typeof v === 'function';

// Every function of `fns`, doing nothing once `live` says its run was superseded.
function guardRun<T extends object>(fns: T, live: () => boolean): T {
  return new Proxy(fns, {
    get: (target, name) => {
      const fn: unknown = Reflect.get(target, name);
      return isCallable(fn) ? (...args: unknown[]) => (live() ? fn(...args) : undefined) : fn;
    },
  });
}

// One-shot identity + project hydration (auth gate -> guest id ->
// participant -> project/share/password resolution -> tab seeding),
// lifted out of editor-page.tsx verbatim. The most entangled effect in
// the page: it reads/writes ~25 state slices, so the setters + the
// last-saved/loaded refs are passed as grouped bundles. Auth resolution
// goes through the tested resolveProjectSession kernel. Deps array stays
// [authLoaded, passwordRetry].
export function useIdentityBootstrap(opts: {
  authLoaded: boolean;
  passwordRetry: number;
  hydrated: boolean;
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // The read-only embed view (docs/specs/013-workspace/embeds.md): its reads are not opens.
  embed: boolean;
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md): the session
  // names the project and the person; see workbench-bootstrap.ts.
  workbench: WorkbenchProjectSession | null;
  activeId: string;
  selfParticipant: Participant;
  refreshProjectList: (ownerId: string) => void;
  refreshSharedList: (ownerId: string) => void;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  refs: {
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
    noteChangesetSeen: (tabId: string, rev: number) => void;
  };
  set: {
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
    // The one tab a tab-scoped link opens (docs/specs/013-workspace/tab-scoped-share-links.md); null = all.
    setSessionTabScope: (scope: string | null) => void;
    setSharedProjects: SetState<SharedWithItem[]>;
    setShareLinks: SetState<ShareLink[]>;
    setSharePasswordSet: SetState<boolean>;
    setSharePasswordGate: SetState<{ invalid: boolean } | null>;
    setIdentityPromptOpen: SetState<boolean>;
  };
}) {
  const {
    authLoaded,
    passwordRetry,
    hydrated,
    accountUserId,
    accountDisplayName,
    embed,
    workbench,
    activeId,
    selfParticipant,
    refs,
    set,
  } = opts;
  const {
    lastPersistedSelfRef,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    noteChangesetSeen,
  } = refs;

  // The bootstrap runs once auth has settled (and again on a password retry), reading everything else as
  // it is at that moment: an effect event, so the setters and values it reads are never triggers.
  const runRef = useRef(0);
  // `early`: a project in This Browser opening before auth has settled (docs/specs/006-project/offline-mode.md
  // "Instant open"). It has no owner on the server to wait for, so it loads under the placeholder
  // participant and settleEarlyIdentity resolves who is reading once auth answers.
  const bootstrap = useEffectEvent((early = false) => {
    if (hydrated) return;
    // Wait for the session to determine the auth state before bootstrapping.
    // Otherwise a signed-in user lands here with `accountUserId === null`
    // briefly, we mint a guest id, and the participant record + every
    // subsequent project load uses the wrong owner. With this gate
    // the effect re-runs once `authLoaded` flips true.
    if (!authLoaded && !early) return;
    // A later run (auth settling twice: sign-in answering after the guest timeout, then a guest migration) supersedes
    // this one: a superseded run's writes are dropped, so a stale guest-identity load never overwrites the newer one.
    const generation = ++runRef.current;
    const live = () => runRef.current === generation;
    const resetTabs = guardRun({ resetTabs: opts.resetTabs }, live).resetTabs;
    const { refreshProjectList, refreshSharedList } = guardRun(
      { refreshProjectList: opts.refreshProjectList, refreshSharedList: opts.refreshSharedList },
      live,
    );
    const {
      setActiveId,
      setProjectId,
      setProjectName,
      setProjectItemTypes,
      setProjectNotFound,
      setLoadError,
      setProjectTrashed,
      setProjectOwnerColor,
      setProjectOwnerId,
      setProjectOwnerName,
      setProjectShareable,
      setProjectShareCode,
      setProjectTeamId,
      setProjectServerStored,
      setHydrated,
      setIsOwner,
      setLoadedExistingProject,
      setLoadedTabIds,
      setLoadingProject,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionTabScope,
      setSharedProjects,
      setShareLinks,
      setSharePasswordSet,
      setSharePasswordGate,
      setIdentityPromptOpen,
    } = guardRun(set, live);

    // The tab-seeding + owner-field body both arrival branches share —
    // see seed-fetched-project.ts.
    const seedOnce = makeSeedFetchedProject({
      activeId,
      // An embed's or a workbench's read is not an open (docs/specs/013-workspace/explorer-home.md "Opens").
      recordOpen: !embed && workbench === null,
      resetTabs,
      lastSavedTabsRef,
      lastSavedNameRef,
      loadedTabIdsRef,
      noteChangesetSeen,
      setActiveId,
      setProjectName,
      setProjectItemTypes,
      setProjectOwnerColor,
      setProjectOwnerId,
      setProjectOwnerName,
      setProjectShareable,
      setProjectShareCode,
      setProjectTeamId,
      setLoadedExistingProject,
      setLoadedTabIds,
    });
    // The seed writes refs too (the saved tabs, the loaded ids): a superseded run never starts one.
    const seedFetchedProject: typeof seedOnce = async (...args) => {
      if (live()) await seedOnce(...args);
    };
    // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): once auth has settled we
    // know whether this open is a guest or a signed-in user. Fire-and-
    // forget, gated to once per browser per UTC day inside the helper,
    // so it's safe to run on every editor mount.
    if (!early) trackDailyReturn(!!accountUserId);
    // The watchdog (docs/specs/007-editor/load-recovery.md): a load that has not ended in time shows
    // the load-error screen (after one self-healing reload per tab), and a load that lands after it
    // replaces that screen with the editor.
    const armWatchdog = () =>
      armLoadWatchdog(
        () => {
          setLoadError(true);
          setLoadingProject(false);
        },
        { warn: (type) => track('Error', 'Warning', type) },
      );
    // How long the project took to open (docs/specs/017-telemetry/timing-telemetry.md): from when it
    // was asked for to the first frame painted after the load reached `done`. A password retry is not
    // timed (its wait is a person typing), and a load that failed, never got there, or was superseded
    // by a later run records nothing.
    const run = (watchdog: ReturnType<typeof armLoadWatchdog>, load: () => Promise<void>) =>
      void (async () => {
        const timing =
          passwordRetry === 0
            ? startEditorTiming('ProjectLoad', { from: projectLoadOrigin() })
            : null;
        try {
          await load();
          if (live() && getLoadProgress().step === 'done') timing?.endAfterPaint();
          else timing?.cancel();
        } catch (err) {
          timing?.cancel();
          // Anything the load throws outside its handled branches ends on the load-error screen, never
          // on the opening screen forever.
          console.error('[load] the project load threw', err);
          track('Error', 'Client', errorTypeToken('ProjectLoad', errorNameToken(err)));
          setLoadError(true);
          setLoadingProject(false);
        } finally {
          watchdog.finish();
          if (live()) noteProjectLoadEnded();
        }
      })();
    if (workbench) {
      const watchdog = armWatchdog();
      run(watchdog, async () => {
        await loadWorkbenchProject({
          workbench,
          seed: seedFetchedProject,
          lastPersistedSelfRef,
          set: {
            setSelfParticipant,
            setProjectId,
            setProjectTrashed,
            setLoadError,
            setProjectNotFound,
            setProjectServerStored,
            setIsOwner,
            setSessionRole,
            setNameConfirmed,
            setHydrated,
            setLoadingProject,
            setSessionShareCode,
            setSessionTabScope,
            setSharePasswordGate,
          },
        });
        setLoadStep('done');
        if (watchdog.finish()) setLoadError(false);
      });
      return;
    }
    // The post-mount hydration is async (the API is HTTP) so we run it
    // inside an IIFE. UI stays at the placeholder during the fetch;
    // the welcome modal is gated on `hydrated` so it doesn't flash the
    // Guest placeholder name into the input.
    //
    // Path scheme (docs/specs/007-editor/new-project-route.md): `/project/<id>` is the owner URL.
    // The static export ships a single placeholder file at
    // `out/project/placeholder/index.html`; the editor worker rewrites
    // `/project/<anything>` → that file so the browser receives the
    // editor HTML. The client router still fires notFound() for
    // every non-`placeholder` id, but `apps/editor/app/not-found.tsx`
    // rescues that by rendering the editor in the not-found slot —
    // see the file comment there. Either way this component mounts
    // with the real id still in `window.location.pathname`, which
    // we parse out here.
    const initialUrl = new URL(window.location.href);
    // Clean routing (docs/specs/016-platform/router-app.md): the editor lives at `/project/<id>`, no
    // `/live` prefix. Match the id straight off the path.
    // `placeholder` (the static-export build artefact) reads as no id. The editor's address from
    // before the rename (@/lib/legacy-editor-path) can still arrive while a deploy rolls out; the
    // bar is corrected to /project/<id>.
    const { id: initialId, legacy } = projectIdFromPath(initialUrl.pathname);
    if (initialId && legacy) {
      window.history.replaceState(
        null,
        '',
        `/project/${initialId}${initialUrl.search}${initialUrl.hash}`,
      );
    }
    const initialShareCode = initialUrl.searchParams.get('s');
    // No path id and no share code on the editor's own route → the user landed on the placeholder
    // route directly. Hand off to /new for the welcome flow. Any other address (a mistyped or retired
    // page the not-found slot serves the editor for) is not found, never a new project: see load().
    if (!initialId && !initialShareCode && isEditorPath(initialUrl.pathname)) {
      window.location.assign(`${window.location.origin}/new`);
      return;
    }
    const watchdog = armWatchdog();
    const load = async () => {
      const id = initialId;
      const shareCodeParam = initialShareCode;

      // Identity comes first because every project fetch needs an
      // owner id. On password retries (passwordRetry > 0) we already
      // resolved the participant on the first attempt — reuse it rather
      // than hitting /api/participants again on every wrong guess.
      let self: Participant;
      if (early) {
        // A project in This Browser reads from this browser whoever is reading: the identity follows.
        self = selfParticipant;
      } else if (selfParticipant.id !== 'self') {
        // Already resolved — skip the network round-trip.
        self = selfParticipant;
      } else {
        // Two ways in (docs/specs/014-identity/auth-and-guest-access.md): see resolve-participant.ts.
        self = await resolveParticipant({
          accountUserId,
          accountDisplayName,
          onParticipantStep: () => setLoadStep('participant'),
        });
        // The project-write key (docs/specs/012-collaboration/participant-responses.md) is stamped onto the LOCAL
        // participant only, never onto `self` as it goes to `apiSaveSelf`: it belongs to this browser,
        // not to the account. A second device signed in as the same person is a second person as far
        // as a done check is concerned — and it is a second presence entry too, so that stays consistent.
        setSelfParticipant({ ...self, key: ensureCollabKey(), status: 'online' });
        // Seed the persistence guard so the post-hydration effect doesn't
        // immediately echo the same name/color back via PUT.
        lastPersistedSelfRef.current = { name: self.name, color: self.color };
      }

      // The NotFound / load-error pages render the Explorer panel behind
      // the status card so the user can still navigate to their other
      // projects — which only works if those early-return paths fetch the
      // Explorer's lists too. Called on each of them below; the success
      // path keeps its own calls at the end of this effect (AFTER the
      // share-visit registration, so refreshSharedList sees the new row).
      const seedExplorerLists = () => {
        // An early open's lists wait for the real participant (settleEarlyIdentity).
        if (early) return;
        refreshProjectList(self.id);
        refreshSharedList(self.id);
      };

      // An address that names no project and carries no share link (docs/specs/007-editor/new-project-route.md
      // "Unknown addresses"): the not-found card over the Explorer. It used to send the reader to /new, so a
      // mistyped or retired page opened the New Project wizard with no word of what went wrong.
      if (!id && !shareCodeParam) {
        debugLog('[load] not an editor address, showing not found');
        setProjectNotFound(true);
        seedExplorerLists();
        setHydrated(true);
        setLoadingProject(false);
        setNameConfirmed(hasConfirmedName());
        return;
      }

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full project data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      if (shareCodeParam) {
        // Warm-cache the share password (docs/specs/013-workspace/share-password.md) before the first
        // call so a returning visitor whose password didn't change
        // gets straight to the canvas without the gate. The seed is
        // a no-op when the cache is empty (apiHeaders sees null and
        // skips the X-Share-Password header), and if the server
        // rejects the cached value we'll clear the entry below.
        const cachedPassword = readCachedSharePassword(shareCodeParam);
        if (cachedPassword) setSessionSharePassword(cachedPassword);
        // Pass the visitor's owner id so the api worker can record
        // their visit into shared_with — without it the server can't
        // identify the visitor and the "Shared with you" list stays
        // empty forever.
        setLoadStep('share');
        let resolution;
        try {
          resolution = await apiLoadShared(shareCodeParam, self.id);
        } catch (err) {
          // Couldn't reach the server to resolve the share link (network
          // / 5xx). Retryable, so show the error page instead of the
          // "link revoked / project gone" NotFound below. Unless the link's
          // project is in the Trash (docs/specs/013-workspace/trash.md): the
          // visitor sees that it was deleted.
          if (isProjectTrashedError(err)) setProjectTrashed(true);
          else setLoadError(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingProject(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!resolution) {
          // The share code didn't resolve. Either it never existed,
          // the owner revoked it, or the project was deleted while
          // the visitor still had the link. Surface a NotFound page
          // so the visitor sees an explicit error instead of a
          // silent blank canvas (which used to read as "the
          // project loaded but is empty").
          setProjectNotFound(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingProject(false);
          setNameConfirmed(hasConfirmedName());
          return;
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
          return;
        }
        // Success path. Persist whatever password the session is
        // currently using (cached seed OR fresh user input) so the
        // next load skips the gate.
        const accepted = getSessionSharePassword();
        if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
        {
          const { project: fetched, role, tabId: scopeTabId } = resolution;
          const session = resolveProjectSession({
            projectOwnerId: fetched.ownerId,
            selfId: self.id,
            shareRole: role,
            shareCodeParam,
            embed,
          });
          const codeForVisitor = session.sessionShareCode;
          // Tab seeding + name + owner fields (shared with the owner-URL
          // branch below) — see seed-fetched-project.ts. Visitors present
          // their session share code on the eager first-tab fetch.
          // Scope first: seeding makes the scoped tab active, and the active-tab
          // guard refuses any other (docs/specs/013-workspace/tab-scoped-share-links.md).
          setSessionTabScope(scopeTabId);
          setLoadStep('first-tab');
          await seedFetchedProject(self.id, fetched, codeForVisitor, scopeTabId);
          // A share link always opens a server project: it has a room.
          setProjectServerStored(true);
          setProjectId(fetched.id);
          setIsOwner(session.isOwner);
          // Visitors inherit the role from their share code; owners are
          // always 'edit' (see resolveProjectSession).
          setSessionRole(session.sessionRole);
          // Visitor: stash the code they came in on so any log
          // writes can present it as authorisation. Owner accessing
          // via a share URL keeps null.
          setSessionShareCode(session.sessionShareCode);
          // Signed-in user opening their own project via a share URL
          // already has a confirmed identity — never prompt. Visitors
          // (signed in or not) still see the welcome card so they get
          // the "you're joining X's project" context; the name input
          // is locked downstream when they have an account identity so
          // they can't pretend to be someone else.
          const isOwnerVisit = session.isOwner;
          if (!isOwnerVisit && !hasConfirmedName()) {
            setIdentityPromptOpen(true);
          }
          // Optimistically add the current project to the shared-with
          // list so it appears in the Explorer immediately, before the
          // refreshSharedList network round-trip completes. The server
          // fetch will replace this with the full list; deduplicate so
          // returning visitors don't see a duplicate row.
          if (!isOwnerVisit) {
            setSharedProjects((prev) =>
              prev.some((d) => d.id === fetched.id)
                ? prev
                : [
                    {
                      id: fetched.id,
                      name: fetched.name,
                      savedAt: fetched.savedAt,
                      role,
                      shareCode: shareCodeParam,
                      tabId: scopeTabId,
                      ownerName: fetched.ownerName ?? null,
                      ownerColor: fetched.ownerColor ?? null,
                      // Not known from the tab summaries: ask for the thumbnail, as the server list will say.
                      empty: false,
                    },
                    ...prev,
                  ],
            );
          }
          // Project·Joined is counted by the api worker when it resolves
          // the share code, once per (visitor, project) (docs/specs/017-telemetry/telemetry.md). Emitting
          // here counted every refresh and return visit.
        }
      } else if (id) {
        setLoadStep('project');
        let fetched;
        try {
          fetched = await apiLoadProject(self.id, id);
        } catch (err) {
          // The load FAILED (network down / 5xx) — not a clean 404.
          // Surface a retryable error page rather than NotFound, which
          // would wrongly tell the user the project doesn't exist. A project
          // in the Trash (docs/specs/013-workspace/trash.md) is neither: it
          // gets the deleted card.
          setProjectId(id);
          if (isProjectTrashedError(err)) setProjectTrashed(true);
          else setLoadError(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingProject(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!fetched) {
          // URL had a ?d=<id> but the API didn't return anything for
          // us — either the project doesn't exist or we don't own it.
          // Surface a NotFound page instead of dropping the user into
          // the new-project welcome flow.
          setProjectId(id);
          setProjectNotFound(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingProject(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        // Past the `!fetched` return above, so the project is loaded.
        // Tab seeding + name + owner fields (shared with the visitor
        // branch above) — see seed-fetched-project.ts. The owner's
        // eager first-tab fetch presents no share code.
        setLoadStep('first-tab');
        await seedFetchedProject(self.id, fetched, null, null);
        // An offline project (docs/specs/006-project/offline-mode.md) is yours by construction — its
        // ownerId is the local sentinel, never a participant id, so
        // without this it would wrongly get visitor chrome (Make a
        // copy, the owner badge row).
        const offline = fetched.ownerId === OFFLINE_OWNER_ID;
        // Every server-stored project has a room, personal ones included (docs/specs/024-agents/
        // agent-changesets.md "Rooms for personal projects"); an offline one has none.
        setProjectServerStored(!offline);
        setIsOwner(offline || fetched.ownerId === self.id);
        setSessionRole('edit');
        // A team project opened here was let in as owner or joined member, and every joined
        // member may share it (mayShareProject), so they get the list too.
        if (offline || fetched.ownerId === self.id || fetched.teamId) {
          // Prefetch the share-link list so the dialog opens
          // populated — cloud only; an offline project has nothing
          // on the server to share.
          if (!offline) {
            apiListShareLinks(self.id, fetched.id)
              .then(({ links, passwordSet }) => {
                setShareLinks(links);
                setSharePasswordSet(passwordSet);
              })
              .catch(() => {});
          }
        }
        // Owner branch (`?d=<id>` / `/project/<id>`): a signed-in
        // user is by definition the owner here and their identity is
        // settled — skip the identity prompt entirely. Guests fall
        // back to the legacy localStorage gate so they still get the
        // one-time naming nudge.
        if (!early && !accountUserId && !hasConfirmedName()) {
          setIdentityPromptOpen(true);
        }
        setProjectId(id);
      }
      setNameConfirmed(hasConfirmedName());
      seedExplorerLists();
      // Folder list is auto-loaded by the useFolders hook once
      // selfParticipant.id transitions off the placeholder — no
      // manual fetch needed here.
      setHydrated(true);
      setLoadingProject(false);
      // A load that outlived its watchdog replaces the load-error screen it put up.
      setLoadStep('done');
      if (watchdog.finish()) setLoadError(false);
    };
    run(watchdog, load);
  });
  // Instant open (docs/specs/006-project/offline-mode.md): before auth settles, a path naming a project in
  // This Browser opens straight from this browser. Share links, embeds and workbenches always wait.
  const earlyOpen = useRef(false);
  const tryEarlyOpen = useEffectEvent(async () => {
    if (authLoaded || hydrated || embed || workbench) return;
    const url = new URL(window.location.href);
    const { id } = projectIdFromPath(url.pathname);
    if (!id || url.searchParams.has('s')) return;
    if (!(await isOfflineId(id))) return;
    // Auth may have answered while the local index loaded: then the ordinary bootstrap has run.
    if (runRef.current !== 0) return;
    earlyOpen.current = true;
    debugLog('[load] early open of a project in This Browser');
    bootstrap(true);
  });
  // Once auth answers after an early open: who is reading, their lists, and the guest naming nudge,
  // all in the background of a project already on screen.
  const settleEarlyIdentity = useEffectEvent(() => {
    void (async () => {
      const self = await resolveParticipant({ accountUserId, accountDisplayName });
      opts.set.setSelfParticipant({ ...self, key: ensureCollabKey(), status: 'online' });
      lastPersistedSelfRef.current = { name: self.name, color: self.color };
      trackDailyReturn(!!accountUserId);
      if (!accountUserId && !hasConfirmedName()) opts.set.setIdentityPromptOpen(true);
      opts.set.setNameConfirmed(hasConfirmedName());
      opts.refreshProjectList(self.id);
      opts.refreshSharedList(self.id);
    })().catch((err: unknown) => console.warn('[load] resolving the reader failed', err));
  });
  useLayoutEffect(() => {
    void tryEarlyOpen();
  }, []);
  useLayoutEffect(() => {
    if (earlyOpen.current) {
      if (authLoaded) settleEarlyIdentity();
      return;
    }
    bootstrap();
  }, [authLoaded, passwordRetry]);
}
