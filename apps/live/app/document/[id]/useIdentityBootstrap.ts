import type { ItemTypeCatalogue } from '@livediagram/items';
import {
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffectEvent,
} from 'react';
import { documentIdFromPath } from '@/lib/legacy-editor-path';
import type { Tab } from '@livediagram/document';
import type { CommunitySession } from './editor-realtime';
import {
  apiListShareLinks,
  apiLoadDocument,
  apiLoadSelf,
  apiLoadShared,
  apiSaveSelf,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
  type ShareLink,
  type SharedWithItem,
  type ShareRole,
} from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { ensureCollabKey, hasConfirmedName } from '@/lib/local-identity';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { resolveDocumentSession } from './editor-page-helpers';
import { makeSeedFetchedDocument } from './seed-fetched-document';
import { isDocumentTrashedError } from '@/lib/document-trashed';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { documentLoadOrigin, noteDocumentLoadEnded, startEditorTiming } from '@/lib/timing';
import { errorNameToken, errorTypeToken } from '@livediagram/api-schema';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import { loadWorkbenchDocument } from './workbench-bootstrap';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Every function of `fns`, doing nothing once `live` says its run was superseded.
function guardRun<T extends object>(fns: T, live: () => boolean): T {
  return new Proxy(fns, {
    get: (target, name) => {
      const fn: unknown = Reflect.get(target, name);
      return typeof fn === 'function'
        ? (...args: unknown[]) => (live() ? fn(...args) : undefined)
        : fn;
    },
  });
}

// One-shot identity + document hydration (Clerk gate -> guest id ->
// participant -> document/share/password resolution -> tab seeding),
// lifted out of editor-page.tsx verbatim. The most entangled effect in
// the page: it reads/writes ~25 state slices, so the setters + the
// last-saved/loaded refs are passed as grouped bundles. Auth resolution
// goes through the tested resolveDocumentSession kernel. Deps array stays
// [authLoaded, passwordRetry].
export function useIdentityBootstrap(opts: {
  authLoaded: boolean;
  passwordRetry: number;
  hydrated: boolean;
  clerkUserId: string | null | undefined;
  clerkDisplayName: string | null | undefined;
  // The read-only embed view (docs/specs/013-workspace/embeds.md): its reads are not opens.
  embed: boolean;
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md): the session
  // names the document and the person; see workbench-bootstrap.ts.
  workbench: WorkbenchSession | null;
  activeId: string;
  selfParticipant: Participant;
  refreshDocumentList: (ownerId: string) => void;
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
    setDocumentId: SetState<string | null>;
    setDocumentName: SetState<string>;
    setDocumentPresentation: SetState<string | null>;
    setDocumentItemTypes: SetState<ItemTypeCatalogue | null>;
    setDocumentNotFound: SetState<boolean>;
    setLoadError: SetState<boolean>;
    // The document is in the Trash (docs/specs/013-workspace/trash.md).
    setDocumentTrashed: (trashed: boolean) => void;
    setDocumentOwnerColor: SetState<string | null>;
    setDocumentOwnerId: SetState<string | null>;
    setDocumentOwnerName: SetState<string | null>;
    setDocumentShareable: SetState<boolean>;
    setDocumentTeamId: SetState<string | null>;
    setDocumentServerStored: SetState<boolean>;
    setDocumentShareCode: SetState<string | null>;
    setHydrated: SetState<boolean>;
    setIsOwner: SetState<boolean>;
    setLoadedExistingDocument: SetState<boolean>;
    setLoadedTabIds: SetState<Set<string>>;
    setLoadingDocument: SetState<boolean>;
    setNameConfirmed: SetState<boolean>;
    setSelfParticipant: SetState<Participant>;
    setSessionRole: SetState<ShareRole>;
    setSessionShareCode: SetState<string | null>;
    // The Community post a community link opened (docs/specs/025-community/community.md).
    setSessionCommunity: SetState<CommunitySession | null>;
    // The one tab a tab-scoped link opens (docs/specs/013-workspace/tab-scoped-share-links.md); null = all.
    setSessionTabScope: (scope: string | null) => void;
    setSharedDocuments: SetState<SharedWithItem[]>;
    setShareLinks: SetState<ShareLink[]>;
    setSharePasswordSet: SetState<boolean>;
    setSharePasswordGate: SetState<{ invalid: boolean } | null>;
    setTemplatePickerMode: SetState<'welcome' | 'templates' | 'identity'>;
  };
}) {
  const {
    authLoaded,
    passwordRetry,
    hydrated,
    clerkUserId,
    clerkDisplayName,
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
  const bootstrap = useEffectEvent(() => {
    if (hydrated) return;
    // Wait for Clerk to determine the auth state before bootstrapping.
    // Otherwise a signed-in user lands here with `clerkUserId === null`
    // briefly, we mint a guest id, and the participant record + every
    // subsequent document load uses the wrong owner. With this gate
    // the effect re-runs once `authLoaded` flips true.
    if (!authLoaded) return;
    // A later run (auth settling twice: Clerk answering after the guest timeout, then a guest migration) supersedes
    // this one: a superseded run's writes are dropped, so a stale guest-identity load never overwrites the newer one.
    const generation = ++runRef.current;
    const live = () => runRef.current === generation;
    const resetTabs = guardRun({ resetTabs: opts.resetTabs }, live).resetTabs;
    const { refreshDocumentList, refreshSharedList } = guardRun(
      { refreshDocumentList: opts.refreshDocumentList, refreshSharedList: opts.refreshSharedList },
      live,
    );
    const {
      setActiveId,
      setDocumentId,
      setDocumentName,
      setDocumentPresentation,
      setDocumentItemTypes,
      setDocumentNotFound,
      setLoadError,
      setDocumentTrashed,
      setDocumentOwnerColor,
      setDocumentOwnerId,
      setDocumentOwnerName,
      setDocumentShareable,
      setDocumentShareCode,
      setDocumentTeamId,
      setDocumentServerStored,
      setHydrated,
      setIsOwner,
      setLoadedExistingDocument,
      setLoadedTabIds,
      setLoadingDocument,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionCommunity,
      setSessionTabScope,
      setSharedDocuments,
      setShareLinks,
      setSharePasswordSet,
      setSharePasswordGate,
      setTemplatePickerMode,
    } = guardRun(set, live);

    // The tab-seeding + owner-field body both arrival branches share —
    // see seed-fetched-document.ts.
    const seedOnce = makeSeedFetchedDocument({
      activeId,
      // An embed's or a workbench's read is not an open (docs/specs/013-workspace/explorer-home.md "Opens").
      recordOpen: !embed && workbench === null,
      resetTabs,
      lastSavedTabsRef,
      lastSavedNameRef,
      loadedTabIdsRef,
      noteChangesetSeen,
      setActiveId,
      setDocumentName,
      setDocumentPresentation,
      setDocumentItemTypes,
      setDocumentOwnerColor,
      setDocumentOwnerId,
      setDocumentOwnerName,
      setDocumentShareable,
      setDocumentShareCode,
      setDocumentTeamId,
      setLoadedExistingDocument,
      setLoadedTabIds,
    });
    // The seed writes refs too (the saved tabs, the loaded ids): a superseded run never starts one.
    const seedFetchedDocument: typeof seedOnce = async (...args) => {
      if (live()) await seedOnce(...args);
    };
    // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): once auth has settled we
    // know whether this open is a guest or a signed-in user. Fire-and-
    // forget, gated to once per browser per UTC day inside the helper,
    // so it's safe to run on every editor mount.
    trackDailyReturn(!!clerkUserId);
    // The watchdog (docs/specs/007-editor/load-recovery.md): a load that has not ended in time shows
    // the load-error screen (after one self-healing reload per tab), and a load that lands after it
    // replaces that screen with the editor.
    const armWatchdog = () =>
      armLoadWatchdog(
        () => {
          setLoadError(true);
          setLoadingDocument(false);
        },
        { warn: (type) => track('Error', 'Warning', type) },
      );
    // How long the document took to open (docs/specs/017-telemetry/timing-telemetry.md): from when it
    // was asked for to the first frame painted after the load reached `done`. A password retry is not
    // timed (its wait is a person typing), and a load that failed, never got there, or was superseded
    // by a later run records nothing.
    const run = (watchdog: ReturnType<typeof armLoadWatchdog>, load: () => Promise<void>) =>
      void (async () => {
        const timing =
          passwordRetry === 0
            ? startEditorTiming('DocumentLoad', { from: documentLoadOrigin() })
            : null;
        try {
          await load();
          if (live() && getLoadProgress().step === 'done') timing?.endAfterPaint();
          else timing?.cancel();
        } catch (err) {
          timing?.cancel();
          // Anything the load throws outside its handled branches ends on the load-error screen, never
          // on the opening screen forever.
          console.error('[load] the document load threw', err);
          track('Error', 'Client', errorTypeToken('DocumentLoad', errorNameToken(err)));
          setLoadError(true);
          setLoadingDocument(false);
        } finally {
          watchdog.finish();
          if (live()) noteDocumentLoadEnded();
        }
      })();
    if (workbench) {
      const watchdog = armWatchdog();
      run(watchdog, async () => {
        await loadWorkbenchDocument({
          workbench,
          seed: seedFetchedDocument,
          lastPersistedSelfRef,
          set: {
            setSelfParticipant,
            setDocumentId,
            setDocumentTrashed,
            setLoadError,
            setDocumentNotFound,
            setDocumentServerStored,
            setIsOwner,
            setSessionRole,
            setNameConfirmed,
            setHydrated,
            setLoadingDocument,
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
    // Path scheme (docs/specs/007-editor/new-document-route.md): `/document/<id>` is the owner URL.
    // The static export ships a single placeholder file at
    // `out/document/placeholder/index.html`; the live worker rewrites
    // `/document/<anything>` → that file so the browser receives the
    // editor HTML. The client router still fires notFound() for
    // every non-`placeholder` id, but `apps/live/app/not-found.tsx`
    // rescues that by rendering the editor in the not-found slot —
    // see the file comment there. Either way this component mounts
    // with the real id still in `window.location.pathname`, which
    // we parse out here.
    const initialUrl = new URL(window.location.href);
    // Clean routing (docs/specs/016-platform/router-app.md): the editor lives at `/document/<id>`, no
    // `/live` prefix. Match the id straight off the path.
    // `placeholder` (the static-export build artefact) reads as no id. The editor's address from
    // before the rename (@/lib/legacy-editor-path) can still arrive while a deploy rolls out; the
    // bar is corrected to /document/<id>.
    const { id: initialId, legacy } = documentIdFromPath(initialUrl.pathname);
    if (initialId && legacy) {
      window.history.replaceState(
        null,
        '',
        `/document/${initialId}${initialUrl.search}${initialUrl.hash}`,
      );
    }
    const initialShareCode = initialUrl.searchParams.get('s');
    // No path id and no share code → the user landed on the placeholder
    // route directly. Hand off to /live/new for the welcome flow.
    if (!initialId && !initialShareCode) {
      window.location.assign(`${window.location.origin}/new`);
      return;
    }
    const watchdog = armWatchdog();
    const load = async () => {
      const id = initialId;
      const shareCodeParam = initialShareCode;

      // Identity comes first because every document fetch needs an
      // owner id. On password retries (passwordRetry > 0) we already
      // resolved the participant on the first attempt — reuse it rather
      // than hitting /api/participants again on every wrong guess.
      let self: Participant;
      if (selfParticipant.id !== 'self') {
        // Already resolved — skip the network round-trip.
        self = selfParticipant;
      } else {
        // Two ways in (docs/specs/014-identity/auth-and-guest-access.md): when signed in, the Clerk userId becomes
        // the canonical participant id. When signed out, fall back to the
        // localStorage guest UUID.
        // For a guest, resolve a SERVER-SIGNED id (minting one on first
        // visit, upgrading a legacy unsigned id) so the eventual sign-up
        // migrate can prove possession. Falls back to a local unsigned id
        // offline. See docs/specs/014-identity/auth-and-guest-access.md + lib/guest-identity.ts.
        const selfId = clerkUserId ?? (await ensureSignedGuestIdentity()).id;
        setLoadStep('participant');
        const storedSelf = await apiLoadSelf(selfId).catch(() => null);
        // Signed-in users always use their Clerk-known name on the
        // participant record. For a brand-new participant (no storedSelf)
        // this seeds the row; for an existing one we overwrite so it stays
        // in sync with the user's Clerk profile. Guests keep the existing
        // random placeholder so their chosen identity isn't blown away.
        const baseSelf: Participant = storedSelf ?? {
          id: selfId,
          name: randomName(),
          color: randomColor(),
          status: 'online',
        };
        self =
          clerkUserId && clerkDisplayName
            ? { ...baseSelf, name: clerkDisplayName, status: 'online' }
            : { ...baseSelf, status: 'online' };
        // The document-write key (docs/specs/012-collaboration/participant-responses.md) is stamped onto the LOCAL
        // participant only, never onto `self` as it goes to `apiSaveSelf`
        // below: it belongs to this browser, not to the account. A second
        // device signed in as the same person is a second person as far as
        // a done check is concerned — and it is a second presence entry too,
        // so that stays consistent.
        setSelfParticipant({ ...self, key: ensureCollabKey(), status: 'online' });
        // Persist on first load, or when a signed-in user's Clerk display
        // name has drifted from what we have on the server.
        const nameDrifted = !!(
          storedSelf &&
          clerkUserId &&
          clerkDisplayName &&
          storedSelf.name !== clerkDisplayName
        );
        if (!storedSelf || nameDrifted) await apiSaveSelf(self).catch(() => {});
        // Seed the persistence guard so the post-hydration effect doesn't
        // immediately echo the same name/color back via PUT.
        lastPersistedSelfRef.current = { name: self.name, color: self.color };
      }

      // The NotFound / load-error pages render the Explorer panel behind
      // the status card so the user can still navigate to their other
      // documents — which only works if those early-return paths fetch the
      // Explorer's lists too. Called on each of them below; the success
      // path keeps its own calls at the end of this effect (AFTER the
      // share-visit registration, so refreshSharedList sees the new row).
      const seedExplorerLists = () => {
        refreshDocumentList(self.id);
        refreshSharedList(self.id);
      };

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full document data via the share-code endpoint and
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
          // "link revoked / document gone" NotFound below. Unless the link's
          // document is in the Trash (docs/specs/013-workspace/trash.md): the
          // visitor sees that it was deleted.
          if (isDocumentTrashedError(err)) setDocumentTrashed(true);
          else setLoadError(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingDocument(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!resolution) {
          // The share code didn't resolve. Either it never existed,
          // the owner revoked it, or the document was deleted while
          // the visitor still had the link. Surface a NotFound page
          // so the visitor sees an explicit error instead of a
          // silent blank canvas (which used to read as "the
          // document loaded but is empty").
          setDocumentNotFound(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingDocument(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if ('passwordRequired' in resolution) {
          // The document is password-protected (docs/specs/013-workspace/share-password.md). Show the gate
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
          setLoadingDocument(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        // Success path. Persist whatever password the session is
        // currently using (cached seed OR fresh user input) so the
        // next load skips the gate.
        const accepted = getSessionSharePassword();
        if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
        {
          const { document: fetched, role, tabId: scopeTabId, community } = resolution;
          const session = resolveDocumentSession({
            documentOwnerId: fetched.ownerId,
            selfId: self.id,
            shareRole: role,
            shareCodeParam,
            community: community !== null,
          });
          const codeForVisitor = session.sessionShareCode;
          // Tab seeding + name + owner fields (shared with the owner-URL
          // branch below) — see seed-fetched-document.ts. Visitors present
          // their session share code on the eager first-tab fetch.
          // Scope first: seeding makes the scoped tab active, and the active-tab
          // guard refuses any other (docs/specs/013-workspace/tab-scoped-share-links.md).
          setSessionTabScope(scopeTabId);
          setLoadStep('first-tab');
          await seedFetchedDocument(self.id, fetched, codeForVisitor, scopeTabId);
          // A share link always opens a server document: it has a room.
          setDocumentServerStored(true);
          setDocumentId(fetched.id);
          setIsOwner(session.isOwner);
          // Visitors inherit the role from their share code; owners are
          // always 'edit' (see resolveDocumentSession).
          setSessionRole(session.sessionRole);
          // Visitor: stash the code they came in on so any log
          // writes can present it as authorisation. Owner accessing
          // via a share URL keeps null.
          setSessionShareCode(session.sessionShareCode);
          // A Community post's link (docs/specs/025-community/community.md "Viewing a post's
          // document"): no room, no name prompt, not added to Shared with you.
          // The author too opens it read-only (resolveDocumentSession), with a way to their own board.
          const viaCommunity = community !== null;
          setSessionCommunity(
            community
              ? { ...community, ownDocumentId: fetched.ownerId === self.id ? fetched.id : null }
              : null,
          );
          // Signed-in user opening their own document via a share URL
          // already has a confirmed identity — never prompt. Visitors
          // (signed in or not) still see the welcome card so they get
          // the "you're joining X's document" context; the name input
          // is locked downstream when they have a Clerk identity so
          // they can't pretend to be someone else.
          const isOwnerVisit = session.isOwner;
          if (!isOwnerVisit && !viaCommunity && !hasConfirmedName()) {
            setTemplatePickerMode('identity');
          }
          // Optimistically add the current document to the shared-with
          // list so it appears in the Explorer immediately, before the
          // refreshSharedList network round-trip completes. The server
          // fetch will replace this with the full list; deduplicate so
          // returning visitors don't see a duplicate row.
          if (!isOwnerVisit && !viaCommunity) {
            setSharedDocuments((prev) =>
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
          // Document·Joined is counted by the api worker when it resolves
          // the share code, once per (visitor, document) (docs/specs/017-telemetry/telemetry.md). Emitting
          // here counted every refresh and return visit.
        }
      } else if (id) {
        setLoadStep('document');
        let fetched;
        try {
          fetched = await apiLoadDocument(self.id, id);
        } catch (err) {
          // The load FAILED (network down / 5xx) — not a clean 404.
          // Surface a retryable error page rather than NotFound, which
          // would wrongly tell the user the document doesn't exist. A document
          // in the Trash (docs/specs/013-workspace/trash.md) is neither: it
          // gets the deleted card.
          setDocumentId(id);
          if (isDocumentTrashedError(err)) setDocumentTrashed(true);
          else setLoadError(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingDocument(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!fetched) {
          // URL had a ?d=<id> but the API didn't return anything for
          // us — either the document doesn't exist or we don't own it.
          // Surface a NotFound page instead of dropping the user into
          // the new-document welcome flow.
          setDocumentId(id);
          setDocumentNotFound(true);
          seedExplorerLists();
          setHydrated(true);
          setLoadingDocument(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        // Past the `!fetched` return above, so the document is loaded.
        // Tab seeding + name + owner fields (shared with the visitor
        // branch above) — see seed-fetched-document.ts. The owner's
        // eager first-tab fetch presents no share code.
        setLoadStep('first-tab');
        await seedFetchedDocument(self.id, fetched, null, null);
        // An offline document (docs/specs/006-document/offline-mode.md) is yours by construction — its
        // ownerId is the local sentinel, never a participant id, so
        // without this it would wrongly get visitor chrome (Make a
        // copy, the owner badge row).
        const offline = fetched.ownerId === OFFLINE_OWNER_ID;
        // Every server-stored document has a room, personal ones included (docs/specs/024-agents/
        // agent-changesets.md "Rooms for personal documents"); an offline one has none.
        setDocumentServerStored(!offline);
        setIsOwner(offline || fetched.ownerId === self.id);
        setSessionRole('edit');
        if (offline || fetched.ownerId === self.id) {
          // Prefetch the share-link list so the dialog opens
          // populated — cloud only; an offline document has nothing
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
        // Owner branch (`?d=<id>` / `/document/<id>`): a signed-in
        // user is by definition the owner here and their identity is
        // settled — skip the identity prompt entirely. Guests fall
        // back to the legacy localStorage gate so they still get the
        // one-time naming nudge.
        if (!clerkUserId && !hasConfirmedName()) {
          setTemplatePickerMode('identity');
        }
        setDocumentId(id);
      }
      setNameConfirmed(hasConfirmedName());
      refreshDocumentList(self.id);
      refreshSharedList(self.id);
      // Folder list is auto-loaded by the useFolders hook once
      // selfParticipant.id transitions off the placeholder — no
      // manual fetch needed here.
      setHydrated(true);
      setLoadingDocument(false);
      // A load that outlived its watchdog replaces the load-error screen it put up.
      setLoadStep('done');
      if (watchdog.finish()) setLoadError(false);
    };
    run(watchdog, load);
  });
  useLayoutEffect(() => {
    bootstrap();
  }, [authLoaded, passwordRetry]);
}
