// One-shot identity + design hydration (auth gate -> guest id -> participant -> design/share/password resolution
// -> tab seeding), the editors' one copy in @liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore,
// bound here to this editor's design: its setters, its seed, its arrival and its modules, each read at call time
// (tests mock the modules they come from). Deps array stays [authLoaded, passwordRetry].
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  useIdentityBootstrapCore,
  type BootstrapSeedContext,
  type IdentityBootstrapDeps,
} from '@liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore';
import { openOwnAddress, openShareLink } from '@liveworkspace/workbench/lib/editor-arrival';
import type { Tab } from '@livedesign/design';
import type { LiveDoc } from '@livedesign/api-schema';
import { errorNameToken, errorTypeToken } from '@livedesign/api-schema';
import { designIdFromPath, isEditorPath } from '@/lib/legacy-editor-path';
import { isOfflineId } from '@/lib/offline/offline-store';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, getGuestSelfId, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { lastSeenCopies } from '@/lib/last-seen';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { WARM_PAINT_CODE } from '@/lib/editor-deferred-code';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { designLoadOrigin, noteDesignLoadEnded, startEditorTiming } from '@/lib/timing';
import type { WorkbenchDesignSession } from '@/components/providers/workbench-session-context';
import { resolveParticipant } from './resolve-participant';
import { makePaintLastSeen, makeSeedFetchedDesign, type SeedDeps } from './seed-fetched-design';
import { arrivalSetters, DESIGN_ARRIVAL, type BootstrapSet } from './design-arrival';
import { loadWorkbenchDesign } from './workbench-bootstrap';

// What the seed and the warm paint show the design through (seed-fetched-design.ts), with the run's setters.
const seedDeps = (s: BootstrapSet, ctx: BootstrapSeedContext<Tab>): SeedDeps => ({
  ...ctx,
  setActiveId: s.setActiveId,
  setDesignName: s.setDesignName,
  setDesignOwnerName: s.setDesignOwnerName,
  setDesignShareable: s.setDesignShareable,
  setDesignShareCode: s.setDesignShareCode,
  setDesignTeamId: s.setDesignTeamId,
  setLoadedExistingDesign: s.setLoadedExistingDesign,
  setLoadedTabIds: s.setLoadedTabIds,
});

const DEPS: IdentityBootstrapDeps<
  BootstrapSet,
  Tab,
  Participant,
  LiveDoc,
  LiveDoc,
  WorkbenchDesignSession
> = {
  notFoundKey: 'setDesignNotFound',
  setNotFound: (s) => s.setDesignNotFound,
  setLoading: (s) => s.setLoadingDesign,
  noun: 'design',
  // The editor's address from before the rename (@/lib/legacy-editor-path) can still arrive while a deploy rolls out:
  // the bar is corrected to /design/<id>.
  readPath: (pathname) => {
    const { id, legacy } = designIdFromPath(pathname);
    return { id, canonical: id && legacy ? `/design/${id}` : null };
  },
  isEditorPath: (pathname) => isEditorPath(pathname),
  isOfflineId: (id) => isOfflineId(id),
  resolveParticipant: (args) => resolveParticipant(args),
  ensureCollabKey: () => ensureCollabKey(),
  getGuestSelfId: () => getGuestSelfId(),
  hasConfirmedName: () => hasConfirmedName(),
  trackDailyReturn: (signedIn) => trackDailyReturn(signedIn),
  readSignedInHint: () => readSignedInHint(),
  lastSeenCopies: () => lastSeenCopies,
  warmPaintCode: () => WARM_PAINT_CODE,
  makeSeed: (s, ctx) => makeSeedFetchedDesign(seedDeps(s, ctx)),
  makePaint: (s, ctx) => makePaintLastSeen(seedDeps(s, ctx)),
  openShareLink: ({ set, ...run }, link) =>
    openShareLink(DESIGN_ARRIVAL, { ...run, set: arrivalSetters(set) }, link),
  openOwnAddress: ({ set, ...run }, own) =>
    openOwnAddress(DESIGN_ARRIVAL, { ...run, set: arrivalSetters(set) }, own),
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md): see workbench-bootstrap.ts.
  loadWorkbench: ({ set, ...rest }) =>
    loadWorkbenchDesign({
      ...rest,
      set: {
        setSelfParticipant: set.setSelfParticipant,
        setDesignId: set.setDesignId,
        setDesignTrashed: set.setDesignTrashed,
        setLoadError: set.setLoadError,
        setDesignNotFound: set.setDesignNotFound,
        setDesignServerStored: set.setDesignServerStored,
        setIsOwner: set.setIsOwner,
        setSessionRole: set.setSessionRole,
        setNameConfirmed: set.setNameConfirmed,
        setHydrated: set.setHydrated,
        setLoadingDesign: set.setLoadingDesign,
        setSessionShareCode: set.setSessionShareCode,
        setSessionTabScope: set.setSessionTabScope,
        setSharePasswordGate: set.setSharePasswordGate,
      },
    }),
  armLoadWatchdog: (onTimedOut, deps) => armLoadWatchdog(onTimedOut, deps),
  loadStep: () => getLoadProgress().step,
  setLoadStep: (step) => setLoadStep(step),
  track: (category, action, type) => track(category, action, type),
  loadErrorType: (err) => errorTypeToken('DesignLoad', errorNameToken(err)),
  loadOrigin: () => designLoadOrigin(),
  noteLoadEnded: () => noteDesignLoadEnded(),
  timeLoad: (from) => startEditorTiming('DesignLoad', { from }),
  timeWarmPaint: (from) => startEditorTiming('WarmPaint', { from }),
};

export function useIdentityBootstrap(opts: {
  authLoaded: boolean;
  passwordRetry: number;
  hydrated: boolean;
  accountUserId: string | null | undefined;
  accountDisplayName: string | null | undefined;
  // The read-only embed view (docs/specs/013-workspace/embeds.md): its reads are not opens.
  embed: boolean;
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md): the session
  // names the design and the person; see workbench-bootstrap.ts.
  workbench: WorkbenchDesignSession | null;
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
}): void {
  useIdentityBootstrapCore(DEPS, opts);
}
