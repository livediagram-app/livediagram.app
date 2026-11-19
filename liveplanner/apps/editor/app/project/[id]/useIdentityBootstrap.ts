// One-shot identity + project hydration (auth gate -> guest id -> participant -> project/share/password resolution
// -> tab seeding), the editors' one copy in @liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore,
// bound here to this editor's project: its setters, its seed, its arrival and its modules, each read at call time
// (tests mock the modules they come from). Deps array stays [authLoaded, passwordRetry].
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  useIdentityBootstrapCore,
  type BootstrapSeedContext,
  type IdentityBootstrapDeps,
} from '@liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore';
import { openOwnAddress, openShareLink } from '@liveworkspace/workbench/lib/editor-arrival';
import { tabKindOf, type Tab } from '@liveplanner/project';
import type { Project } from '@liveplanner/api-schema';
import { errorNameToken, errorTypeToken } from '@liveplanner/api-schema';
import { projectIdFromPath, isEditorPath } from '@/lib/editor-path';
import { isOfflineId } from '@/lib/offline/offline-store';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, getGuestSelfId, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { lastSeenCopies } from '@/lib/last-seen';
import { planCopyPaints, warmPlanOf, type PlanCopyItem } from '@/lib/last-seen-plan';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { WARM_PAINT_CODE } from '@/lib/editor-deferred-code';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { projectLoadOrigin, noteProjectLoadEnded, startEditorTiming } from '@/lib/timing';
import type { WorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import { resolveParticipant } from './resolve-participant';
import { makePaintLastSeen, makeSeedFetchedProject, type SeedDeps } from './seed-fetched-project';
import { arrivalSetters, PLAN_ARRIVAL, type BootstrapSetters } from './bootstrap-arrivals';
import { loadWorkbenchProject } from './workbench-bootstrap';

// What the seed and the warm paint show the project through (seed-fetched-project.ts), with the run's setters.
const seedDeps = (s: BootstrapSetters, ctx: BootstrapSeedContext<Tab>): SeedDeps => ({
  ...ctx,
  setActiveId: s.setActiveId,
  setProjectName: s.setProjectName,
  setProjectItemTypes: s.setProjectItemTypes,
  setProjectOwnerName: s.setProjectOwnerName,
  setProjectShareable: s.setProjectShareable,
  setProjectShareCode: s.setProjectShareCode,
  setProjectTeamId: s.setProjectTeamId,
  setLoadedExistingProject: s.setLoadedExistingProject,
  setLoadedTabIds: s.setLoadedTabIds,
});

const DEPS: IdentityBootstrapDeps<
  BootstrapSetters,
  Tab,
  Participant,
  PlanCopyItem,
  Project,
  WorkbenchProjectSession
> = {
  notFoundKey: 'setProjectNotFound',
  setNotFound: (s) => s.setProjectNotFound,
  setLoading: (s) => s.setLoadingProject,
  noun: 'project',
  readPath: (pathname) => ({ id: projectIdFromPath(pathname) }),
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
  makeSeed: (s, ctx) => makeSeedFetchedProject(seedDeps(s, ctx)),
  makePaint: (s, ctx) => makePaintLastSeen(seedDeps(s, ctx)),
  openShareLink: ({ set, ...run }, link) =>
    openShareLink(PLAN_ARRIVAL, { ...run, set: arrivalSetters(set) }, link),
  openOwnAddress: ({ set, ...run }, own) =>
    openOwnAddress(PLAN_ARRIVAL, { ...run, set: arrivalSetters(set) }, own),
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md): see workbench-bootstrap.ts.
  loadWorkbench: ({ set, ...rest }) =>
    loadWorkbenchProject({
      ...rest,
      set: {
        setSelfParticipant: set.setSelfParticipant,
        setProjectId: set.setProjectId,
        setProjectTrashed: set.setProjectTrashed,
        setLoadError: set.setLoadError,
        setProjectNotFound: set.setProjectNotFound,
        setProjectServerStored: set.setProjectServerStored,
        setIsOwner: set.setIsOwner,
        setSessionRole: set.setSessionRole,
        setNameConfirmed: set.setNameConfirmed,
        setHydrated: set.setHydrated,
        setLoadingProject: set.setLoadingProject,
        setSessionShareCode: set.setSessionShareCode,
        setSessionTabScope: set.setSessionTabScope,
        setSharePasswordGate: set.setSharePasswordGate,
      },
    }),
  armLoadWatchdog: (onTimedOut, deps) => armLoadWatchdog(onTimedOut, deps),
  loadStep: () => getLoadProgress().step,
  setLoadStep: (step) => setLoadStep(step),
  track: (category, action, type) => track(category, action, type),
  loadErrorType: (err) => errorTypeToken('ProjectLoad', errorNameToken(err)),
  loadOrigin: () => projectLoadOrigin(),
  noteLoadEnded: () => noteProjectLoadEnded(),
  timeLoad: (from) => startEditorTiming('ProjectLoad', { from }),
  timeWarmPaint: (from) => startEditorTiming('WarmPaint', { from }),
  // A Form first tab waits for the load, and a Board, Dashboard or Sheet without what it draws from opens as always.
  paintsCopy: (copy) => {
    if (planCopyPaints(copy)) return true;
    debugLog('[last-seen] plan copy skipped', {
      first: tabKindOf(copy.firstTab?.tab as { kind?: string } | undefined),
    });
    return false;
  },
  // The cards and sheets the copy kept, for the stores to show; gone with someone else's copy.
  onWarmPaint: (s, copy) => s.setWarmPlan(warmPlanOf(copy)),
  onWarmDropped: (s) => s.setWarmPlan(null),
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
}): void {
  useIdentityBootstrapCore(DEPS, opts);
}
