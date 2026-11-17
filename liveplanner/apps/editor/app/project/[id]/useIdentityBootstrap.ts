import {
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffectEvent,
} from 'react';
import { projectIdFromPath, isEditorPath } from '@/lib/editor-path';
import type { Tab } from '@liveplanner/project';
import { isOfflineId } from '@/lib/offline/offline-store';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { resolveParticipant } from './resolve-participant';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, getGuestSelfId, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { makePaintLastSeen, makeSeedFetchedProject, type SeedDeps } from './seed-fetched-project';
import { lastSeenCopies } from '@/lib/last-seen';
import { planCopyPaints, warmPlanOf, type PlanCopyItem } from '@/lib/last-seen-plan';
import { tabKindOf } from '@liveplanner/project';
import { readSignedInHint } from '@/lib/signed-in-hint';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';
import {
  markLanding,
  measureAfterPaint,
  readWarmCopy,
  type WarmOpenAddress,
  type WarmOpenWho,
  warmPaintCodeIn,
  browserWarmOpenFallbackDeps,
  guardNotFound,
  warmOpenFallback,
} from '@liveworkspace/workbench/lib/warm-open';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { WARM_PAINT_CODE } from '@/lib/editor-deferred-code';
import { track } from '@/lib/telemetry';
import { projectLoadOrigin, noteProjectLoadEnded, startEditorTiming } from '@/lib/timing';
import { errorNameToken, errorTypeToken } from '@liveplanner/api-schema';
import type { WorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import { loadWorkbenchProject } from './workbench-bootstrap';
import { guardRun } from '@liveworkspace/workbench/lib/guard-run';
import { openOwnAddress, openShareLink } from '@liveworkspace/workbench/lib/editor-arrival';
import { arrivalSetters, PLAN_ARRIVAL, type BootstrapSetters } from './bootstrap-arrivals';

// One-shot identity + project hydration (auth gate -> guest id ->
// participant -> project/share/password resolution -> tab seeding),
// lifted out of editor-page.tsx verbatim. The most entangled effect in
// the page: it reads/writes ~25 state slices, so the setters + the
// last-saved/loaded refs are passed as grouped bundles. Auth resolution
// goes through the tested resolveProjectSession kernel. Deps array stays
// [authLoaded, passwordRetry].
// The setters that say who is reading or prompt for a name: they change nothing a warm paint shows, so a load that has
// called only these has not landed (markLanding).
const QUIET_SETTERS: ReadonlySet<string> = new Set([
  'setSelfParticipant',
  'setNameConfirmed',
  'setIdentityPromptOpen',
]);

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
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  refs: {
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
    noteChangesetSeen: (tabId: string, rev: number) => void;
  };
  set: BootstrapSetters;
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
  const warmRef = useRef<LastSeenCopy<PlanCopyItem, unknown> | null>(null);
  // The copy this mount painted, kept past the someone-else swap: a not found after it is checked by a cold open.
  const paintedRef = useRef<LastSeenCopy<PlanCopyItem, unknown> | null>(null);
  // Whether a load has begun to write the screen (markLanding), and who it resolved as reading: until it has, a warm
  // read that answers late still paints, for that reader only.
  const landedRef = useRef(false);
  const readerRef = useRef<string | null>(null);
  // The tab on screen, for the catch-up to keep (seed-fetched's keepActiveId): a person who moved off the
  // warm-painted tab stays where they went.
  const activeIdRef = useRef(activeId);
  useLayoutEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  // What the seed and the warm paint show the project through (seed-fetched-project.ts), with the run's setters.
  const seedDeps = (
    s: BootstrapSetters,
    resetTabs: Dispatch<SetStateAction<Tab[]>>,
    recordOpen: boolean,
  ): SeedDeps => ({
    activeId,
    recordOpen,
    resetTabs,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    noteChangesetSeen,
    setActiveId: s.setActiveId,
    setProjectName: s.setProjectName,
    setProjectItemTypes: s.setProjectItemTypes,
    setProjectOwnerColor: s.setProjectOwnerColor,
    setProjectOwnerId: s.setProjectOwnerId,
    setProjectOwnerName: s.setProjectOwnerName,
    setProjectShareable: s.setProjectShareable,
    setProjectShareCode: s.setProjectShareCode,
    setProjectTeamId: s.setProjectTeamId,
    setLoadedExistingProject: s.setLoadedExistingProject,
    setLoadedTabIds: s.setLoadedTabIds,
    warmFirstTab: () => warmRef.current?.firstTab ?? null,
    keepActiveId: () => (warmRef.current ? activeIdRef.current : null),
  });
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
    const landing = markLanding(
      guardRun(set, live),
      () => {
        landedRef.current = true;
      },
      QUIET_SETTERS,
    );
    // A not found after a warm paint (offline-mode.md "Never a wrong not found") is checked once by an ordinary, cold
    // open before it shows: the copy is forgotten and the page reloads.
    const guarded = guardNotFound(landing, 'setProjectNotFound', () => {
      const painted = paintedRef.current;
      return (
        painted !== null &&
        warmOpenFallback(
          'not-found',
          painted.itemId,
          browserWarmOpenFallbackDeps(() => lastSeenCopies.forget(painted.reader, painted.itemId)),
        )
      );
    });
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
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionTabScope,
      setSharePasswordGate,
    } = guarded;

    // The tab-seeding + owner-field body both arrival branches share —
    // see seed-fetched-project.ts.
    // An embed's or a workbench's read is not an open (docs/specs/013-workspace/explorer-home.md "Opens").
    const seedOnce = makeSeedFetchedProject(
      seedDeps(guarded, resetTabs, !embed && workbench === null),
    );
    // The seed writes refs too (the saved tabs, the loaded ids): a superseded run never starts one.
    const seedFetchedProject: typeof seedOnce = async (...args) => {
      return live() ? seedOnce(...args) : null;
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
          if (live() && getLoadProgress().step === 'done') {
            timing?.endAfterPaint();
            // The warm open's catch-up landed: its own timing mark, from the same start.
            if (warmRef.current) measureAfterPaint('warm-catch-up', projectLoadOrigin());
          } else timing?.cancel();
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
    // `placeholder` (the static-export build artefact) reads as no id.
    const initialId = projectIdFromPath(initialUrl.pathname);
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
      readerRef.current = self.id;
      // The warm open painted someone else's copy (a signed-in hint that outlived its session): it leaves the screen
      // at once, and the load opens the plan for whoever is reading.
      if (warmRef.current && warmRef.current.reader !== self.id) {
        warmRef.current = null;
        guarded.setWarmTabId(null);
        guarded.setWarmPlan(null);
        setLoadingProject(true);
      }

      // An address that names no project and carries no share link (docs/specs/007-editor/new-project-route.md
      // "Unknown addresses"): the not-found card over the Explorer. It used to send the reader to /new, so a
      // mistyped or retired page opened the New Project wizard with no word of what went wrong.
      if (!id && !shareCodeParam) {
        debugLog('[load] not an editor address, showing not found');
        setProjectNotFound(true);
        setHydrated(true);
        setLoadingProject(false);
        setNameConfirmed(hasConfirmedName());
        return;
      }

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full project data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      const arrival = { self, seed: seedFetchedProject, set: arrivalSetters(guarded) };
      if (shareCodeParam) {
        const reached = await openShareLink(PLAN_ARRIVAL, arrival, { shareCodeParam, id, embed });
        if (!reached) return;
      } else if (id) {
        const reached = await openOwnAddress(PLAN_ARRIVAL, arrival, { id, early, accountUserId });
        if (!reached) return;
      }
      setNameConfirmed(hasConfirmedName());
      setHydrated(true);
      setLoadingProject(false);
      // A load that outlived its watchdog replaces the load-error screen it put up.
      setLoadStep('done');
      if (watchdog.finish()) setLoadError(false);
    };
    run(watchdog, load);
  });
  // The warm paint: the copy shown read-only (as a Viewer, whatever role it was kept with) under the placeholder
  // participant, with the cards and sheets it kept for the stores to show. Nothing is saved or sent and the room waits:
  // all of that needs `hydrated` and a project id, which only the catch-up sets.
  const paintWarm = useEffectEvent((copy: LastSeenCopy<PlanCopyItem, unknown>, origin?: number) => {
    debugLog('[load] warm open from the last seen copy');
    const s = opts.set;
    makePaintLastSeen(seedDeps(s, opts.resetTabs, false))(copy);
    warmRef.current = copy;
    paintedRef.current = copy;
    s.setWarmPlan(warmPlanOf(copy));
    s.setWarmTabId(copy.firstTab?.id ?? null);
    s.setIsOwner(copy.access.isOwner);
    s.setSessionTabScope(copy.access.tabScope);
    s.setSessionRole('view');
    s.setLoadingProject(false);
    measureAfterPaint('warm-paint', origin);
    // The same moment as a timing (timing-telemetry.md "WarmPaint"), so production shows how fast a warm open paints.
    startEditorTiming('WarmPaint', { from: origin }).endAfterPaint();
  });
  // Instant open (docs/specs/006-project/offline-mode.md): before auth settles, a path naming a project in
  // This Browser opens straight from this browser. Share links, embeds and workbenches always wait. A cloud plan this
  // browser opened before warm-opens from its last seen copy instead ("Warm open of a cloud project").
  const earlyOpen = useRef(false);
  const warmTried = useRef(false);
  // A signed-in hint's warm read waits for the session (offline-mode.md "The warm open"): the hint says whether,
  // never who, so the address waits here until auth names the account, and warmForAccount reads for it.
  const warmAddress = useRef<WarmOpenAddress | null>(null);
  // The read and the paint, for the reader `who` names.
  const warmRead = useEffectEvent(async (address: WarmOpenAddress, who: WarmOpenWho) => {
    // From the page's start on a fresh page, else from this read: the warm paint's wait is the read and the paint.
    const origin = projectLoadOrigin() ?? performance.now();
    const copy = await readWarmCopy(lastSeenCopies, address, who);
    if (!copy) return;
    // A Form first tab waits for the load, and a Board, Dashboard or Sheet without what it draws from opens as always.
    if (!planCopyPaints(copy)) {
      debugLog('[last-seen] plan copy skipped', {
        first: tabKindOf(copy.firstTab?.tab as { kind?: string } | undefined),
      });
      return;
    }
    // The code of what the paint mounts first (offline-mode.md "The code it draws is in first"), bounded: the board
    // and the card panel host then draw in the paint's own commit, with nothing left waiting on code.
    await warmPaintCodeIn(WARM_PAINT_CODE);
    // Too late: the ordinary load has begun to show what it fetched, or resolved someone else as reading. A load that
    // has only started (a guest's auth settles at once) is not: the copy paints and the load replaces it.
    if (landedRef.current) return;
    if (readerRef.current !== null && readerRef.current !== copy.reader) return;
    paintWarm(copy, origin);
  });
  // Auth has answered under a signed-in hint: the copy is read for the account the session named, once. A session
  // that answered signed out (the hint outlived it) reads nothing: the accounts bridge has emptied the store.
  const warmForAccount = useEffectEvent(() => {
    const address = warmAddress.current;
    if (!address || !authLoaded) return;
    warmAddress.current = null;
    if (!accountUserId || hydrated) return;
    warmRead(address, { signedIn: true, accountId: accountUserId }).catch((err: unknown) =>
      debugLog('[load] no warm open', err),
    );
  });
  const tryEarlyOpen = useEffectEvent(async () => {
    if (authLoaded || hydrated || embed || workbench) return;
    // Once per mount: StrictMode runs the layout effect twice in dev, which painted and measured twice.
    if (warmTried.current) return;
    warmTried.current = true;
    const url = new URL(window.location.href);
    const id = projectIdFromPath(url.pathname);
    const shareCode = url.searchParams.get('s');
    if (id && !shareCode && (await isOfflineId(id))) {
      // Auth may have answered while the local index loaded: then the ordinary bootstrap has run.
      if (runRef.current !== 0) return;
      earlyOpen.current = true;
      debugLog('[load] early open of a project in This Browser');
      bootstrap(true);
      return;
    }
    const address = { itemId: id, shareCode, hash: url.hash };
    if (readSignedInHint()) {
      warmAddress.current = address;
      // Auth may have answered while the local index loaded, after its layout effect ran: then the read goes now
      // (an effect event reads the props as they are when called, not as this read began).
      warmForAccount();
      return;
    }
    await warmRead(address, { signedIn: false, guestId: getGuestSelfId() });
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
    })().catch((err: unknown) => console.warn('[load] resolving the reader failed', err));
  });
  useLayoutEffect(() => {
    // An open that cannot start early (no local index, no copy store) waits for auth as it always did.
    tryEarlyOpen().catch((err: unknown) => debugLog('[load] no early open', err));
  }, []);
  useLayoutEffect(() => {
    if (earlyOpen.current) {
      if (authLoaded) settleEarlyIdentity();
      return;
    }
    // Before the load starts, so the copy's read races the participant's request rather than follows it.
    warmForAccount();
    bootstrap();
  }, [authLoaded, passwordRetry]);
}
