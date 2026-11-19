// The contract between the editors' one identity bootstrap (useIdentityBootstrapCore) and each editor's binding
// (app/<item>/[id]/useIdentityBootstrap.ts): the setters every editor names alike, what the seed is handed, and the
// editor's own side (IdentityBootstrapDeps), each module read at call time so the editors' tests can mock it.
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { LastSeenCopy, LastSeenFirstTab } from '../../lib/api/last-seen-copies';
import type { WarmOpenCopies } from '../../lib/warm-open';

export type BootstrapTiming = { endAfterPaint: () => void; cancel: () => void };

/** The setters every editor names alike. */
export type BootstrapCommonSet<P> = {
  setLoadError: (failed: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  setNameConfirmed: (confirmed: boolean) => void;
  setSelfParticipant: (participant: P) => void;
  setWarmTabId: (id: string | null) => void;
  setIsOwner: (owner: boolean) => void;
  setSessionTabScope: (scope: string | null) => void;
  setSessionRole: (role: 'view') => void;
  setIdentityPromptOpen: (open: boolean) => void;
};

/** What the seed and the warm paint show the item through, with the run's setters added by the editor. */
export type BootstrapSeedContext<Tab> = {
  activeId: string;
  // Whether the first-tab read is an open of the item (an embed's or a workbench's is not).
  recordOpen: boolean;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  noteChangesetSeen: (tabId: string, rev: number) => void;
  // The first tab the warm open painted, or null.
  warmFirstTab: () => LastSeenFirstTab<unknown> | null;
  // The tab the person moved to while the warm open showed, or null.
  keepActiveId: () => string | null;
};

/** The tab seeding and owner fields both arrival branches share: it may answer the first tab it painted. */
export type BootstrapSeed<Loaded> = (
  selfId: string,
  item: Loaded,
  shareCode: string | null,
  scopeTabId: string | null,
) => Promise<void | LastSeenFirstTab<unknown> | null>;

/** One run's side of an arrival: who is reading, its seed and its guarded setters. */
export type BootstrapArrivalRun<S, Loaded> = {
  self: { id: string };
  seed: BootstrapSeed<Loaded>;
  set: S;
};

export type BootstrapParticipant = { id: string; name: string; color: string };

/** An editor's side of the bootstrap: its nouns, its modules (each read at call time, so tests can mock them) and
 *  what its own copy did beyond the others. */
export type IdentityBootstrapDeps<S, Tab, P extends BootstrapParticipant, Item, Loaded, W> = {
  // The setter that shows the not-found card (guarded after a warm paint), and the item's own two setters.
  notFoundKey: keyof S & string;
  setNotFound: (s: S) => (notFound: boolean) => void;
  setLoading: (s: S) => (loading: boolean) => void;
  // The item's noun in log lines ('document', 'design', 'project').
  noun: string;
  // The address: the item a path names, and, for an old address still served, the path the bar is corrected to.
  readPath: (pathname: string) => { id: string | null; canonical?: string | null };
  isEditorPath: (pathname: string) => boolean;
  isOfflineId: (id: string) => Promise<boolean>;
  // Who is reading (createResolveParticipant) and this browser's own identity.
  resolveParticipant: (args: {
    accountUserId: string | null | undefined;
    accountDisplayName: string | null | undefined;
    onParticipantStep?: () => void;
  }) => Promise<P>;
  ensureCollabKey: () => string;
  getGuestSelfId: () => string | null;
  hasConfirmedName: () => boolean;
  trackDailyReturn: (signedIn: boolean) => void;
  readSignedInHint: () => boolean;
  // The last seen copies the warm open reads, and the code its paint mounts first.
  lastSeenCopies: () => WarmOpenCopies<Item> & {
    forget: (reader: string, itemId: string) => Promise<unknown>;
  };
  warmPaintCode: () => readonly (() => Promise<unknown>)[];
  // The seed and the warm paint over the editor's own setters.
  makeSeed: (s: S, ctx: BootstrapSeedContext<Tab>) => BootstrapSeed<Loaded>;
  makePaint: (s: S, ctx: BootstrapSeedContext<Tab>) => (copy: LastSeenCopy<Item, unknown>) => void;
  // The two ways into a stored item (@liveworkspace/workbench/lib/editor-arrival), bound to the editor's product.
  openShareLink: (
    run: BootstrapArrivalRun<S, Loaded>,
    link: { shareCodeParam: string; id: string | null; embed: boolean },
  ) => Promise<boolean>;
  openOwnAddress: (
    run: BootstrapArrivalRun<S, Loaded>,
    own: { id: string; early: boolean; accountUserId: string | null | undefined },
  ) => Promise<boolean>;
  // The editor in a workbench: the session names the item and the person. Left out, an editor has no workbench.
  loadWorkbench?: (args: {
    workbench: W;
    seed: BootstrapSeed<Loaded>;
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    set: S;
  }) => Promise<void>;
  // The load's progress, its watchdog and its telemetry (each editor's lib/load-progress, lib/telemetry, lib/timing).
  armLoadWatchdog: (
    onTimedOut: () => void,
    deps: { warn: (type: string) => void },
  ) => { finish: () => boolean };
  loadStep: () => string | null;
  setLoadStep: (step: 'participant' | 'done') => void;
  track: (category: 'Error', action: 'Warning' | 'Client', type: string) => void;
  loadErrorType: (err: unknown) => string;
  loadOrigin: () => number | undefined;
  noteLoadEnded: () => void;
  timeLoad: (from: number | undefined) => BootstrapTiming;
  timeWarmPaint: (from: number | undefined) => BootstrapTiming;
  // Drifts, each one editor's own:
  // Whether a copy paints at all (liveplanner: a Form first tab, or a tab without what it draws from, waits).
  paintsCopy?: (copy: LastSeenCopy<Item, unknown>) => boolean;
  // What else a warm paint shows, and what goes when someone else's copy leaves the screen (liveplanner's cards).
  onWarmPaint?: (s: S, copy: LastSeenCopy<Item, unknown>) => void;
  onWarmDropped?: (s: S) => void;
};

export type IdentityBootstrapOptions<S, Tab, P, W> = {
  authLoaded: boolean;
  passwordRetry: number;
  hydrated: boolean;
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // The read-only embed view: its reads are not opens.
  embed: boolean;
  // The editor in a workbench, or null.
  workbench: W | null;
  activeId: string;
  selfParticipant: P;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  refs: {
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
    noteChangesetSeen: (tabId: string, rev: number) => void;
  };
  set: S;
};
