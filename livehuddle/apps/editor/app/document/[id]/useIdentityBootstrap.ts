import {
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffectEvent,
} from 'react';
import { documentIdFromPath, isEditorPath } from '@/lib/legacy-editor-path';
import type { Tab } from '@livehuddle/document';
import { isOfflineId } from '@/lib/offline/offline-store';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { resolveParticipant } from './resolve-participant';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { makeSeedFetchedDocument } from './seed-fetched-document';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { documentLoadOrigin, noteDocumentLoadEnded, startEditorTiming } from '@/lib/timing';
import { guardRun } from '@liveworkspace/workbench/lib/guard-run';
import { openOwnAddress, openShareLink } from '@liveworkspace/workbench/lib/editor-arrival';
import { arrivalSetters, DOCUMENT_ARRIVAL, type BootstrapSet } from './document-arrival';
import { errorNameToken, errorTypeToken } from '@livehuddle/api-schema';

// One-shot identity + document hydration (auth gate -> guest id ->
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
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // The read-only embed view (docs/specs/013-workspace/embeds.md): its reads are not opens.
  embed: boolean;
  activeId: string;
  selfParticipant: Participant;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  refs: {
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
    noteChangesetSeen: (tabId: string, rev: number) => void;
  };
  set: BootstrapSet;
}) {
  const {
    authLoaded,
    passwordRetry,
    hydrated,
    accountUserId,
    accountDisplayName,
    embed,
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
  // `early`: a document in This Browser opening before auth has settled (docs/specs/006-document/offline-mode.md
  // "Instant open"). It has no owner on the server to wait for, so it loads under the placeholder
  // participant and settleEarlyIdentity resolves who is reading once auth answers.
  const bootstrap = useEffectEvent((early = false) => {
    if (hydrated) return;
    // Wait for the session to determine the auth state before bootstrapping.
    // Otherwise a signed-in user lands here with `accountUserId === null`
    // briefly, we mint a guest id, and the participant record + every
    // subsequent document load uses the wrong owner. With this gate
    // the effect re-runs once `authLoaded` flips true.
    if (!authLoaded && !early) return;
    // A later run (auth settling twice: sign-in answering after the guest timeout, then a guest migration) supersedes
    // this one: a superseded run's writes are dropped, so a stale guest-identity load never overwrites the newer one.
    const generation = ++runRef.current;
    const live = () => runRef.current === generation;
    const resetTabs = guardRun({ resetTabs: opts.resetTabs }, live).resetTabs;
    const guarded = guardRun(set, live);
    const {
      setActiveId,
      setDocumentName,
      setDocumentNotFound,
      setLoadError,
      setDocumentOwnerColor,
      setDocumentOwnerId,
      setDocumentOwnerName,
      setDocumentShareable,
      setDocumentShareCode,
      setDocumentTeamId,
      setHydrated,
      setLoadedExistingDocument,
      setLoadedTabIds,
      setLoadingDocument,
      setNameConfirmed,
      setSelfParticipant,
    } = guarded;

    // The tab-seeding + owner-field body both arrival branches share —
    // see seed-fetched-document.ts.
    const seedOnce = makeSeedFetchedDocument({
      activeId,
      // An embed's read is not an open (docs/specs/013-workspace/explorer-home.md "Opens").
      recordOpen: !embed,
      resetTabs,
      lastSavedTabsRef,
      lastSavedNameRef,
      loadedTabIdsRef,
      noteChangesetSeen,
      setActiveId,
      setDocumentName,
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
    if (!early) trackDailyReturn(!!accountUserId);
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
    // The post-mount hydration is async (the API is HTTP) so we run it
    // inside an IIFE. UI stays at the placeholder during the fetch;
    // the welcome modal is gated on `hydrated` so it doesn't flash the
    // Guest placeholder name into the input.
    //
    // Path scheme (docs/specs/007-editor/new-document-route.md): `/document/<id>` is the owner URL.
    // The static export ships a single placeholder file at
    // `out/document/placeholder/index.html`; the editor worker rewrites
    // `/document/<anything>` → that file so the browser receives the
    // editor HTML. The client router still fires notFound() for
    // every non-`placeholder` id, but `apps/editor/app/not-found.tsx`
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
    // No path id and no share code on the editor's own route → the user landed on the placeholder
    // route directly. Hand off to /new for the welcome flow. Any other address (a mistyped or retired
    // page the not-found slot serves the editor for) is not found, never a new document: see load().
    if (!initialId && !initialShareCode && isEditorPath(initialUrl.pathname)) {
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
      if (early) {
        // A document in This Browser reads from this browser whoever is reading: the identity follows.
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
        // The document-write key (docs/specs/012-collaboration/participant-responses.md) is stamped onto the LOCAL
        // participant only, never onto `self` as it goes to `apiSaveSelf`: it belongs to this browser,
        // not to the account. A second device signed in as the same person is a second person as far
        // as a done check is concerned — and it is a second presence entry too, so that stays consistent.
        setSelfParticipant({ ...self, key: ensureCollabKey(), status: 'online' });
        // Seed the persistence guard so the post-hydration effect doesn't
        // immediately echo the same name/color back via PUT.
        lastPersistedSelfRef.current = { name: self.name, color: self.color };
      }

      // An address that names no document and carries no share link (docs/specs/007-editor/new-document-route.md
      // "Unknown addresses"): the not-found card over the Explorer. It used to send the reader to /new, so a
      // mistyped or retired page opened the New Document wizard with no word of what went wrong.
      if (!id && !shareCodeParam) {
        debugLog('[load] not an editor address, showing not found');
        setDocumentNotFound(true);
        setHydrated(true);
        setLoadingDocument(false);
        setNameConfirmed(hasConfirmedName());
        return;
      }

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full document data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      const arrival = { self, seed: seedFetchedDocument, set: arrivalSetters(guarded) };
      if (shareCodeParam) {
        if (!(await openShareLink(DOCUMENT_ARRIVAL, arrival, { shareCodeParam, id, embed })))
          return;
      } else if (id) {
        if (!(await openOwnAddress(DOCUMENT_ARRIVAL, arrival, { id, early, accountUserId })))
          return;
      }
      setNameConfirmed(hasConfirmedName());
      setHydrated(true);
      setLoadingDocument(false);
      // A load that outlived its watchdog replaces the load-error screen it put up.
      setLoadStep('done');
      if (watchdog.finish()) setLoadError(false);
    };
    run(watchdog, load);
  });
  // Instant open (docs/specs/006-document/offline-mode.md): before auth settles, a path naming a document in
  // This Browser opens straight from this browser. Share links and embeds always wait.
  const earlyOpen = useRef(false);
  const tryEarlyOpen = useEffectEvent(async () => {
    if (authLoaded || hydrated || embed) return;
    const url = new URL(window.location.href);
    const { id } = documentIdFromPath(url.pathname);
    if (!id || url.searchParams.has('s')) return;
    if (!(await isOfflineId(id))) return;
    // Auth may have answered while the local index loaded: then the ordinary bootstrap has run.
    if (runRef.current !== 0) return;
    earlyOpen.current = true;
    debugLog('[load] early open of a document in This Browser');
    bootstrap(true);
  });
  // Once auth answers after an early open: who is reading and the guest naming nudge,
  // all in the background of a document already on screen.
  const settleEarlyIdentity = useEffectEvent(() => {
    void (async () => {
      const self = await resolveParticipant({ accountUserId, accountDisplayName });
      opts.set.setSelfParticipant({ ...self, key: ensureCollabKey(), status: 'online' });
      lastPersistedSelfRef.current = { name: self.name, color: self.color };
      trackDailyReturn(!!accountUserId);
      if (!accountUserId && !hasConfirmedName()) opts.set.setIdentityPromptOpen(true);
      opts.set.setNameConfirmed(hasConfirmedName());
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
