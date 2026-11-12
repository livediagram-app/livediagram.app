// The document's side of the bootstrap's two ways in (useIdentityBootstrap.ts's `load`; the flow itself is
// @liveworkspace/workbench/lib/editor-arrival): a share link (`?s=<code>`) and the document's own address
// (`/document/<id>`). DOCUMENT_ARRIVAL names the document's loaders, share-password store and session kernel, and
// arrivalSetters hands the bootstrap's guarded setters to the arrival under its names.
import type { Dispatch, SetStateAction } from 'react';
import type { CommunityShareInfo } from '@livediagram/api-schema';
import type { ArrivalProduct, ArrivalSetters } from '@liveworkspace/workbench/lib/editor-arrival';
import {
  apiLoadDocument,
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
import { isDocumentTrashedError } from '@/lib/document-trashed';
import { documentGrant } from '@/lib/api/document-grants';
import { resolveDocumentSession } from './editor-page-helpers';
import type { CommunitySession } from './editor-realtime';

type SetState<T> = Dispatch<SetStateAction<T>>;

// The setters the bootstrap writes, each one guarded by its run (guardRun).
export type BootstrapSet = {
  setActiveId: SetState<string>;
  setDocumentId: SetState<string | null>;
  setDocumentName: SetState<string>;
  setDocumentPresentation: SetState<string | null>;
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
  setSharePasswordGate: SetState<{ invalid: boolean } | null>;
  setIdentityPromptOpen: SetState<boolean>;
};

type LoadedDocument = NonNullable<Awaited<ReturnType<typeof apiLoadDocument>>>;

export const DOCUMENT_ARRIVAL: ArrivalProduct<
  LoadedDocument,
  ShareRole,
  CommunityShareInfo,
  CommunitySession,
  'document'
> = {
  // The resolve needs no id: the index resolves the code to its canvas.
  loadShared: (code, selfId) =>
    apiLoadShared(code, selfId).then((r) =>
      r && 'document' in r ? { ...r, item: r.document } : r,
    ),
  loadOwn: apiLoadDocument,
  ownStep: 'document',
  setLoadStep,
  sharePassword: {
    readCached: readCachedSharePassword,
    writeCached: writeCachedSharePassword,
    getSession: getSessionSharePassword,
    setSession: setSessionSharePassword,
  },
  hasConfirmedName,
  isTrashedError: isDocumentTrashedError,
  resolveSession: ({ ownerId, ...rest }) =>
    resolveDocumentSession({ documentOwnerId: ownerId, ...rest }),
  communitySession: (post, ownDocumentId) => ({ ...post, ownDocumentId }),
  grant: documentGrant,
  // No sharedAddress: a share link's address stays in the bar.
  offlineOwnerId: OFFLINE_OWNER_ID,
};

// The bootstrap's setters under the arrival's names (each still guarded by its run).
export function arrivalSetters(set: BootstrapSet): ArrivalSetters<ShareRole, CommunitySession> {
  return {
    setItemId: set.setDocumentId,
    setNotFound: set.setDocumentNotFound,
    setLoadError: set.setLoadError,
    setTrashed: set.setDocumentTrashed,
    setServerStored: set.setDocumentServerStored,
    setHydrated: set.setHydrated,
    setIsOwner: set.setIsOwner,
    setLoading: set.setLoadingDocument,
    setNameConfirmed: set.setNameConfirmed,
    setSessionRole: set.setSessionRole,
    setSessionShareCode: set.setSessionShareCode,
    setSessionCommunity: set.setSessionCommunity,
    setSessionTabScope: set.setSessionTabScope,
    setSharePasswordGate: set.setSharePasswordGate,
    setIdentityPromptOpen: set.setIdentityPromptOpen,
  };
}
