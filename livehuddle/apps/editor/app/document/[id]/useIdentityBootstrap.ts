// One-shot identity + document hydration (auth gate -> guest id -> participant -> document/share/password resolution
// -> tab seeding), the editors' one copy in @liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore,
// bound here to this editor's document (it has no workbench): its setters, its seed, its arrival and its modules, each read at call time
// (tests mock the modules they come from). Deps array stays [authLoaded, passwordRetry].
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  useIdentityBootstrapCore,
  type BootstrapSeedContext,
  type IdentityBootstrapDeps,
} from '@liveworkspace/workbench/hooks/persistence/useIdentityBootstrapCore';
import { openOwnAddress, openShareLink } from '@liveworkspace/workbench/lib/editor-arrival';
import type { Tab } from '@livehuddle/document';
import type { LiveDoc } from '@livehuddle/api-schema';
import { errorNameToken, errorTypeToken } from '@livehuddle/api-schema';
import { documentIdFromPath, isEditorPath } from '@/lib/editor-path';
import { isOfflineId } from '@/lib/offline/offline-store';
import type { Participant } from '@/lib/identity';
import { ensureCollabKey, getGuestSelfId, hasConfirmedName } from '@/lib/local-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { lastSeenCopies } from '@/lib/last-seen';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { WARM_PAINT_CODE } from '@/lib/editor-deferred-code';
import { armLoadWatchdog, getLoadProgress, setLoadStep } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';
import { documentLoadOrigin, noteDocumentLoadEnded, startEditorTiming } from '@/lib/timing';
import { resolveParticipant } from './resolve-participant';
import { makePaintLastSeen, makeSeedFetchedDocument, type SeedDeps } from './seed-fetched-document';
import { arrivalSetters, DOCUMENT_ARRIVAL, type BootstrapSet } from './document-arrival';

// What the seed and the warm paint show the document through (seed-fetched-document.ts), with the run's setters.
const seedDeps = (s: BootstrapSet, ctx: BootstrapSeedContext<Tab>): SeedDeps => ({
  ...ctx,
  setActiveId: s.setActiveId,
  setDocumentName: s.setDocumentName,
  setDocumentOwnerName: s.setDocumentOwnerName,
  setDocumentShareable: s.setDocumentShareable,
  setDocumentShareCode: s.setDocumentShareCode,
  setDocumentTeamId: s.setDocumentTeamId,
  setLoadedExistingDocument: s.setLoadedExistingDocument,
  setLoadedTabIds: s.setLoadedTabIds,
});

const DEPS: IdentityBootstrapDeps<BootstrapSet, Tab, Participant, LiveDoc, LiveDoc, never> = {
  notFoundKey: 'setDocumentNotFound',
  setNotFound: (s) => s.setDocumentNotFound,
  setLoading: (s) => s.setLoadingDocument,
  noun: 'document',
  readPath: (pathname) => ({ id: documentIdFromPath(pathname) }),
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
  makeSeed: (s, ctx) => makeSeedFetchedDocument(seedDeps(s, ctx)),
  makePaint: (s, ctx) => makePaintLastSeen(seedDeps(s, ctx)),
  openShareLink: ({ set, ...run }, link) =>
    openShareLink(DOCUMENT_ARRIVAL, { ...run, set: arrivalSetters(set) }, link),
  openOwnAddress: ({ set, ...run }, own) =>
    openOwnAddress(DOCUMENT_ARRIVAL, { ...run, set: arrivalSetters(set) }, own),
  armLoadWatchdog: (onTimedOut, deps) => armLoadWatchdog(onTimedOut, deps),
  loadStep: () => getLoadProgress().step,
  setLoadStep: (step) => setLoadStep(step),
  track: (category, action, type) => track(category, action, type),
  loadErrorType: (err) => errorTypeToken('DocumentLoad', errorNameToken(err)),
  loadOrigin: () => documentLoadOrigin(),
  noteLoadEnded: () => noteDocumentLoadEnded(),
  timeLoad: (from) => startEditorTiming('DocumentLoad', { from }),
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
  // livehuddle has no workbench.
  useIdentityBootstrapCore(DEPS, { ...opts, workbench: null });
}
