// The design's side of the bootstrap's two ways in (useIdentityBootstrap.ts's `load`; the flow itself is
// @liveworkspace/workbench/lib/editor-arrival): a share link (`?s=<code>`) and the design's own address
// (`/design/<id>`). DESIGN_ARRIVAL names the design's loaders, share-password store and session kernel, and
// arrivalSetters hands the bootstrap's guarded setters to the arrival under its names.
import type { Dispatch, SetStateAction } from 'react';
import type { CommunityShareInfo } from '@livedesign/api-schema';
import type { ArrivalProduct, ArrivalSetters } from '@liveworkspace/workbench/lib/editor-arrival';
import {
  apiLoadDesign,
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
import { isDesignTrashedError } from '@/lib/design-trashed';
import { designGrant } from '@/lib/api/design-grants';
import { resolveDesignSession } from './editor-page-helpers';
import type { CommunitySession } from './editor-realtime';

type SetState<T> = Dispatch<SetStateAction<T>>;

// The setters the bootstrap writes, each one guarded by its run (guardRun).
export type BootstrapSet = {
  setActiveId: SetState<string>;
  setDesignId: SetState<string | null>;
  setDesignName: SetState<string>;
  setDesignNotFound: SetState<boolean>;
  setLoadError: SetState<boolean>;
  // The design is in the Trash (docs/specs/013-workspace/trash.md).
  setDesignTrashed: (trashed: boolean) => void;
  setDesignOwnerColor: SetState<string | null>;
  setDesignOwnerId: SetState<string | null>;
  setDesignOwnerName: SetState<string | null>;
  setDesignShareable: SetState<boolean>;
  setDesignTeamId: SetState<string | null>;
  setDesignServerStored: SetState<boolean>;
  setDesignShareCode: SetState<string | null>;
  setHydrated: SetState<boolean>;
  setIsOwner: SetState<boolean>;
  setLoadedExistingDesign: SetState<boolean>;
  setLoadedTabIds: SetState<Set<string>>;
  setLoadingDesign: SetState<boolean>;
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

type LoadedDesign = NonNullable<Awaited<ReturnType<typeof apiLoadDesign>>>;

export const DESIGN_ARRIVAL: ArrivalProduct<
  LoadedDesign,
  ShareRole,
  CommunityShareInfo,
  CommunitySession,
  'design'
> = {
  loadShared: (code, selfId, id) =>
    apiLoadShared(code, selfId, id).then((r) =>
      r && 'design' in r ? { ...r, item: r.design } : r,
    ),
  loadOwn: apiLoadDesign,
  ownStep: 'design',
  setLoadStep,
  sharePassword: {
    readCached: readCachedSharePassword,
    writeCached: writeCachedSharePassword,
    getSession: getSessionSharePassword,
    setSession: setSessionSharePassword,
  },
  hasConfirmedName,
  isTrashedError: isDesignTrashedError,
  resolveSession: ({ ownerId, ...rest }) =>
    resolveDesignSession({ designOwnerId: ownerId, ...rest }),
  communitySession: (post, ownDesignId) => ({ ...post, ownDesignId }),
  grant: designGrant,
  offlineOwnerId: OFFLINE_OWNER_ID,
  sharedAddress: (id) => `/design/${encodeURIComponent(id)}`,
};

// The bootstrap's setters under the arrival's names (each still guarded by its run).
export function arrivalSetters(set: BootstrapSet): ArrivalSetters<ShareRole, CommunitySession> {
  return {
    setItemId: set.setDesignId,
    setNotFound: set.setDesignNotFound,
    setLoadError: set.setLoadError,
    setTrashed: set.setDesignTrashed,
    setServerStored: set.setDesignServerStored,
    setHydrated: set.setHydrated,
    setIsOwner: set.setIsOwner,
    setLoading: set.setLoadingDesign,
    setNameConfirmed: set.setNameConfirmed,
    setSessionRole: set.setSessionRole,
    setSessionShareCode: set.setSessionShareCode,
    setSessionCommunity: set.setSessionCommunity,
    setSessionTabScope: set.setSessionTabScope,
    setSharePasswordGate: set.setSharePasswordGate,
    setIdentityPromptOpen: set.setIdentityPromptOpen,
  };
}
