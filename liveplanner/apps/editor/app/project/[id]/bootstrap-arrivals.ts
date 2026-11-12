// The plan's side of the bootstrap's two ways in (useIdentityBootstrap.ts's `load`; the flow itself is
// @liveworkspace/workbench/lib/editor-arrival): a share link (`?s=<code>`) and the plan's own address
// (`/project/<id>`). PLAN_ARRIVAL names the plan's loaders, share-password store and session kernel, and
// arrivalSetters hands the bootstrap's guarded setters to the arrival under its names.
import type { Dispatch, SetStateAction } from 'react';
import type { CommunityShareInfo } from '@liveplanner/api-schema';
import type { ArrivalProduct, ArrivalSetters } from '@liveworkspace/workbench/lib/editor-arrival';
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
import { resolveProjectSession } from './editor-page-helpers';
import type { CommunitySession } from './editor-realtime';

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

type LoadedPlan = NonNullable<Awaited<ReturnType<typeof apiLoadProject>>>;

export const PLAN_ARRIVAL: ArrivalProduct<
  LoadedPlan,
  ShareRole,
  CommunityShareInfo,
  CommunitySession,
  'project'
> = {
  loadShared: (code, selfId, id) =>
    apiLoadShared(code, selfId, id).then((r) =>
      r && 'project' in r ? { ...r, item: r.project } : r,
    ),
  loadOwn: apiLoadProject,
  ownStep: 'project',
  setLoadStep,
  sharePassword: {
    readCached: readCachedSharePassword,
    writeCached: writeCachedSharePassword,
    getSession: getSessionSharePassword,
    setSession: setSessionSharePassword,
  },
  hasConfirmedName,
  isTrashedError: isProjectTrashedError,
  resolveSession: ({ ownerId, ...rest }) =>
    resolveProjectSession({ projectOwnerId: ownerId, ...rest }),
  communitySession: (post, ownProjectId) => ({ ...post, ownProjectId }),
  grant: planGrant,
  offlineOwnerId: OFFLINE_OWNER_ID,
  sharedAddress: (id) => `/project/${encodeURIComponent(id)}`,
};

// The bootstrap's setters under the arrival's names (each still guarded by its run).
export function arrivalSetters(set: BootstrapSetters): ArrivalSetters<ShareRole, CommunitySession> {
  return {
    setItemId: set.setProjectId,
    setNotFound: set.setProjectNotFound,
    setLoadError: set.setLoadError,
    setTrashed: set.setProjectTrashed,
    setServerStored: set.setProjectServerStored,
    setHydrated: set.setHydrated,
    setIsOwner: set.setIsOwner,
    setLoading: set.setLoadingProject,
    setNameConfirmed: set.setNameConfirmed,
    setSessionRole: set.setSessionRole,
    setSessionShareCode: set.setSessionShareCode,
    setSessionCommunity: set.setSessionCommunity,
    setSessionTabScope: set.setSessionTabScope,
    setSharePasswordGate: set.setSharePasswordGate,
    setIdentityPromptOpen: set.setIdentityPromptOpen,
  };
}
