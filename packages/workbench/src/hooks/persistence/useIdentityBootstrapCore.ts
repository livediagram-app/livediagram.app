import { useLayoutEffect, useRef, useEffectEvent, type Dispatch, type SetStateAction } from 'react';
import { debugLog } from '../../lib/debug-log';
import { guardRun } from '../../lib/guard-run';
import type { LastSeenCopy } from '../../lib/api/last-seen-copies';
import {
  browserWarmOpenFallbackDeps,
  guardNotFound,
  markLanding,
  measureAfterPaint,
  readWarmCopy,
  warmOpenFallback,
  warmPaintCodeIn,
  type WarmOpenAddress,
  type WarmOpenWho,
} from '../../lib/warm-open';
import type {
  BootstrapCommonSet,
  BootstrapParticipant,
  BootstrapSeed,
  BootstrapSeedContext,
  IdentityBootstrapDeps,
  IdentityBootstrapOptions,
} from './identity-bootstrap-deps';

export type * from './identity-bootstrap-deps';

// One-shot identity + item hydration (auth gate -> guest id -> participant -> item/share/password resolution -> tab
// seeding), every editor's one copy: each app/<item>/[id]/useIdentityBootstrap.ts binds it to its own model
// (IdentityBootstrapDeps) and keeps its old path and names. The specs, in each product's docs/specs:
// 006-*/offline-mode.md ("Instant open", "Warm open of a cloud document"), 007-editor/load-recovery.md,
// 007-editor/new-*-route.md ("Unknown addresses") and 017-telemetry/timing-telemetry.md. The most entangled effect
// in an editor: it reads and writes about 25 state slices, so the setters and the last-saved and loaded refs come in
// as grouped bundles, and it runs on [authLoaded, passwordRetry].

// The setters that say who is reading or prompt for a name: they change nothing a warm paint shows, so a load that has
// called only these has not landed (markLanding).
const QUIET_SETTERS: ReadonlySet<string> = new Set([
  'setSelfParticipant',
  'setNameConfirmed',
  'setIdentityPromptOpen',
]);

export function useIdentityBootstrapCore<
  S extends BootstrapCommonSet<P>,
  Tab,
  P extends BootstrapParticipant,
  Item extends { tabs: readonly { id: string }[] },
  Loaded,
  W,
>(
  deps: IdentityBootstrapDeps<S, Tab, P, Item, Loaded, W>,
  opts: IdentityBootstrapOptions<S, Tab, P, W>,
): void {
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
  // The last seen copy the warm open painted (offline-mode.md "Warm open of a cloud document"), until the load that
  // catches up replaces it.
  const warmRef = useRef<LastSeenCopy<Item, unknown> | null>(null);
  // The copy this mount painted, kept past the someone-else swap: a not found after it is checked by a cold open.
  const paintedRef = useRef<LastSeenCopy<Item, unknown> | null>(null);
  // Whether a load has begun to write the screen (markLanding), and who it resolved as reading: until it has, a warm
  // read that answers late still paints, for that reader only.
  const landedRef = useRef(false);
  const readerRef = useRef<string | null>(null);
  // The tab on screen, for the catch-up to keep (the seed's keepActiveId): a person who moved off the
  // warm-painted tab stays where they went.
  const activeIdRef = useRef(activeId);
  useLayoutEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  // What the seed and the warm paint show the item through.
  const seedContext = (
    resetTabs: Dispatch<SetStateAction<Tab[]>>,
    recordOpen: boolean,
  ): BootstrapSeedContext<Tab> => ({
    activeId,
    recordOpen,
    resetTabs,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    noteChangesetSeen,
    warmFirstTab: () => warmRef.current?.firstTab ?? null,
    keepActiveId: () => (warmRef.current ? activeIdRef.current : null),
  });
  // `early`: an item in This Browser opening before auth has settled (offline-mode.md "Instant open"). It has no
  // owner on the server to wait for, so it loads under the placeholder participant and settleEarlyIdentity resolves
  // who is reading once auth answers.
  const bootstrap = useEffectEvent((early = false) => {
    if (hydrated) return;
    // Wait for the session to determine the auth state before bootstrapping. Otherwise a signed-in user lands here
    // with `accountUserId === null` briefly, we mint a guest id, and the participant record + every subsequent load
    // uses the wrong owner. With this gate the effect re-runs once `authLoaded` flips true.
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
    const guarded = guardNotFound(landing, deps.notFoundKey, () => {
      const painted = paintedRef.current;
      return (
        painted !== null &&
        warmOpenFallback(
          'not-found',
          painted.itemId,
          browserWarmOpenFallbackDeps(() =>
            deps.lastSeenCopies().forget(painted.reader, painted.itemId),
          ),
        )
      );
    });
    const setNotFound = deps.setNotFound(guarded);
    const setLoading = deps.setLoading(guarded);
    const { setLoadError, setHydrated, setNameConfirmed, setSelfParticipant } = guarded;

    // The tab-seeding + owner-field body both arrival branches share. An embed's or a workbench's read is not an
    // open (explorer-home.md "Opens").
    const seedOnce = deps.makeSeed(guarded, seedContext(resetTabs, !embed && workbench === null));
    // The seed writes refs too (the saved tabs, the loaded ids): a superseded run never starts one.
    const seed: BootstrapSeed<Loaded> = async (...args) => {
      return live() ? seedOnce(...args) : null;
    };
    // Daily-active-returns signal (017-telemetry/telemetry.md): once auth has settled we know whether this open is a
    // guest or a signed-in user. Fire-and-forget, gated to once per browser per UTC day inside the helper, so it's
    // safe to run on every editor mount.
    if (!early) deps.trackDailyReturn(!!accountUserId);
    // The watchdog (load-recovery.md): a load that has not ended in time shows the load-error screen (after one
    // self-healing reload per tab), and a load that lands after it replaces that screen with the editor.
    const armWatchdog = () =>
      deps.armLoadWatchdog(
        () => {
          setLoadError(true);
          setLoading(false);
        },
        { warn: (type) => deps.track('Error', 'Warning', type) },
      );
    // How long the item took to open (timing-telemetry.md): from when it was asked for to the first frame painted
    // after the load reached `done`. A password retry is not timed (its wait is a person typing), and a load that
    // failed, never got there, or was superseded by a later run records nothing.
    const run = (watchdog: { finish: () => boolean }, load: () => Promise<void>) =>
      void (async () => {
        const timing = passwordRetry === 0 ? deps.timeLoad(deps.loadOrigin()) : null;
        try {
          await load();
          if (live() && deps.loadStep() === 'done') {
            timing?.endAfterPaint();
            // The warm open's catch-up landed: its own timing mark, from the same start.
            if (warmRef.current) measureAfterPaint('warm-catch-up', deps.loadOrigin());
          } else timing?.cancel();
        } catch (err) {
          timing?.cancel();
          // Anything the load throws outside its handled branches ends on the load-error screen, never
          // on the opening screen forever.
          console.error(`[load] the ${deps.noun} load threw`, err);
          deps.track('Error', 'Client', deps.loadErrorType(err));
          setLoadError(true);
          setLoading(false);
        } finally {
          watchdog.finish();
          if (live()) deps.noteLoadEnded();
        }
      })();
    if (workbench && deps.loadWorkbench) {
      const loadWorkbench = deps.loadWorkbench;
      const watchdog = armWatchdog();
      run(watchdog, async () => {
        await loadWorkbench({ workbench, seed, lastPersistedSelfRef, set: guarded });
        deps.setLoadStep('done');
        if (watchdog.finish()) setLoadError(false);
      });
      return;
    }
    // The post-mount hydration is async (the API is HTTP) so it runs inside an IIFE. UI stays at the placeholder
    // during the fetch; the welcome modal is gated on `hydrated` so it doesn't flash the Guest placeholder name.
    //
    // Path scheme (new-*-route.md): `/<route>/<id>` is the owner URL. The static export ships a single placeholder
    // page the editor worker rewrites `/<route>/<anything>` to, and the not-found slot renders the editor for every
    // other id, so this mounts with the real id still in `window.location.pathname`, parsed out here.
    const initialUrl = new URL(window.location.href);
    // `placeholder` (the static-export build artefact) reads as no id. An old address still served is corrected in
    // the bar.
    const { id: initialId, canonical } = deps.readPath(initialUrl.pathname);
    if (canonical) {
      window.history.replaceState(null, '', `${canonical}${initialUrl.search}${initialUrl.hash}`);
    }
    const initialShareCode = initialUrl.searchParams.get('s');
    // No path id and no share code on the editor's own route → the user landed on the placeholder
    // route directly. Hand off to /new for the welcome flow. Any other address (a mistyped or retired
    // page the not-found slot serves the editor for) is not found, never a new item: see load().
    if (!initialId && !initialShareCode && deps.isEditorPath(initialUrl.pathname)) {
      window.location.assign(`${window.location.origin}/new`);
      return;
    }
    const watchdog = armWatchdog();
    const load = async () => {
      const id = initialId;
      const shareCodeParam = initialShareCode;

      // Identity comes first because every item fetch needs an owner id. On password retries (passwordRetry > 0)
      // we already resolved the participant on the first attempt: reuse it rather than hitting /api/participants
      // again on every wrong guess.
      let self: P;
      if (early) {
        // An item in This Browser reads from this browser whoever is reading: the identity follows.
        self = selfParticipant;
      } else if (selfParticipant.id !== 'self') {
        // Already resolved: skip the network round-trip.
        self = selfParticipant;
      } else {
        // Two ways in (014-identity/auth-and-guest-access.md): see each editor's resolve-participant.ts.
        self = await deps.resolveParticipant({
          accountUserId,
          accountDisplayName,
          onParticipantStep: () => deps.setLoadStep('participant'),
        });
        // The browser key (lib/local-identity.ts) is stamped onto the LOCAL participant only, never onto `self` as
        // it goes to `apiSaveSelf`: it belongs to this browser, not to the account, so a second device signed in as
        // the same person is a second person (and a second presence entry).
        setSelfParticipant({ ...self, key: deps.ensureCollabKey(), status: 'online' });
        // Seed the persistence guard so the post-hydration effect doesn't
        // immediately echo the same name/color back via PUT.
        lastPersistedSelfRef.current = { name: self.name, color: self.color };
      }
      readerRef.current = self.id;
      // The warm open painted someone else's copy (a signed-in hint that outlived its session): it leaves the screen
      // at once, and the load opens the item for whoever is reading.
      if (warmRef.current && warmRef.current.reader !== self.id) {
        warmRef.current = null;
        guarded.setWarmTabId(null);
        deps.onWarmDropped?.(guarded);
        setLoading(true);
      }

      // Two URL flavours: the item's own address is the owner's, `?s=<code>` a share URL another participant
      // follows. Visitor arrivals get the full item via the share-code endpoint and are flagged `!isOwner`.
      const arrival = { self, seed, set: guarded };
      if (shareCodeParam) {
        if (!(await deps.openShareLink(arrival, { shareCodeParam, id, embed }))) return;
      } else if (id) {
        if (!(await deps.openOwnAddress(arrival, { id, early, accountUserId }))) return;
      } else {
        // An address that names no item and carries no share link (new-*-route.md "Unknown addresses"): the
        // not-found card over the Explorer, never the New wizard with no word of what went wrong.
        debugLog('[load] not an editor address, showing not found');
        setNotFound(true);
        setHydrated(true);
        setLoading(false);
        setNameConfirmed(deps.hasConfirmedName());
        return;
      }
      setNameConfirmed(deps.hasConfirmedName());
      setHydrated(true);
      setLoading(false);
      // A load that outlived its watchdog replaces the load-error screen it put up.
      deps.setLoadStep('done');
      if (watchdog.finish()) setLoadError(false);
    };
    run(watchdog, load);
  });
  // The warm paint: the copy shown read-only (as a Viewer, whatever role it was kept with) under the placeholder
  // participant. Nothing is saved and the room waits: both need `hydrated`, which only the catch-up sets.
  const paintWarm = useEffectEvent((copy: LastSeenCopy<Item, unknown>, origin?: number) => {
    debugLog('[load] warm open from the last seen copy');
    const s = opts.set;
    deps.makePaint(s, seedContext(opts.resetTabs, false))(copy);
    warmRef.current = copy;
    paintedRef.current = copy;
    deps.onWarmPaint?.(s, copy);
    s.setWarmTabId(copy.firstTab?.id ?? null);
    s.setIsOwner(copy.access.isOwner);
    s.setSessionTabScope(copy.access.tabScope);
    s.setSessionRole('view');
    deps.setLoading(s)(false);
    measureAfterPaint('warm-paint', origin);
    // The same moment as a timing (timing-telemetry.md "WarmPaint"), so production shows how fast a warm open paints.
    deps.timeWarmPaint(origin).endAfterPaint();
  });
  // Instant open (offline-mode.md): before auth settles, a path naming an item in This Browser opens straight from
  // this browser. Share links, embeds and workbenches always wait. A cloud item this browser opened before warm-opens
  // from its last seen copy instead ("Warm open of a cloud document").
  const earlyOpen = useRef(false);
  const warmTried = useRef(false);
  // A signed-in hint's warm read waits for the session (offline-mode.md "The warm open"): the hint says whether,
  // never who, so the address waits here until auth names the account, and warmForAccount reads for it.
  const warmAddress = useRef<WarmOpenAddress | null>(null);
  // The read and the paint, for the reader `who` names.
  const warmRead = useEffectEvent(async (address: WarmOpenAddress, who: WarmOpenWho) => {
    // From the page's start on a fresh page, else from this read: the warm paint's wait is the read and the paint.
    const origin = deps.loadOrigin() ?? performance.now();
    const copy = await readWarmCopy(deps.lastSeenCopies(), address, who);
    if (!copy) return;
    if (deps.paintsCopy && !deps.paintsCopy(copy)) return;
    // The code of what the paint mounts first (offline-mode.md "The code it draws is in first"), bounded: anything
    // left waiting on its code would hold back the ordinary load behind its reveal.
    await warmPaintCodeIn(deps.warmPaintCode());
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
    const { id } = deps.readPath(url.pathname);
    const shareCode = url.searchParams.get('s');
    if (id && !shareCode && (await deps.isOfflineId(id))) {
      // Auth may have answered while the local index loaded: then the ordinary bootstrap has run.
      if (runRef.current !== 0) return;
      earlyOpen.current = true;
      debugLog(`[load] early open of a ${deps.noun} in This Browser`);
      bootstrap(true);
      return;
    }
    const address = { itemId: id, shareCode, hash: url.hash };
    if (deps.readSignedInHint()) {
      warmAddress.current = address;
      // Auth may have answered while the local index loaded, after its layout effect ran: then the read goes now
      // (an effect event reads the props as they are when called, not as this read began).
      warmForAccount();
      return;
    }
    await warmRead(address, { signedIn: false, guestId: deps.getGuestSelfId() });
  });
  // Once auth answers after an early open: who is reading and the guest naming nudge, all in the background of an
  // item already on screen.
  const settleEarlyIdentity = useEffectEvent(() => {
    void (async () => {
      const self = await deps.resolveParticipant({ accountUserId, accountDisplayName });
      opts.set.setSelfParticipant({ ...self, key: deps.ensureCollabKey(), status: 'online' });
      lastPersistedSelfRef.current = { name: self.name, color: self.color };
      deps.trackDailyReturn(!!accountUserId);
      if (!accountUserId && !deps.hasConfirmedName()) opts.set.setIdentityPromptOpen(true);
      opts.set.setNameConfirmed(deps.hasConfirmedName());
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
