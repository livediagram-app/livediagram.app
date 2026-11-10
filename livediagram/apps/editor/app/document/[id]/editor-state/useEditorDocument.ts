'use client';

import { useWorkbenchDocumentSession } from '@/components/providers/workbench-session-context';
import { surfaceFlags, type EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import { useCallback, useRef, useState } from 'react';
import { type Tab } from '@livediagram/document';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { participantKey, type Participant } from '@/lib/identity';
import { createTab } from '../editor-page-helpers';
import { createRemoteOpJournal, type RemoteOpJournal } from '../save-baseline';
import { createOwnElementWrites, type OwnElementWrites } from '../own-element-writes';

// Where the editor runs, who is signed in, and the document's own state: its id, whether it has loaded (or
// failed to), the participant, which tabs have their content, and the save baseline the autosave and the room
// share. The toast and confirm services come first, so every later slice can speak. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorDocument(opts: { surface?: EditorSurface }) {
  // Where the editor runs (editor-surface.ts). The read-only embed view (docs/specs/013-workspace/
  // embeds.md) forces view behaviour regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge + tab switcher. A workbench
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed in
  // by its session and drops the app's surroundings and everything beyond its one document.
  // Constant for the lifetime of the page (it comes from which route mounted us), so it's safe in
  // derived consts.
  const surface = opts.surface ?? 'app';
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  const workbench = useWorkbenchDocumentSession();
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (docs/specs/013-workspace/embeds.md) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Sign-in wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useAccountBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();

  const confirm = useConfirm();
  const toast = useToast();

  // identityPromptOpen (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; it closes through useTemplateFlow's
  // `confirmIdentity` / `cancelIdentity`.
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Document on the welcome flow, Skip,
  // or Join Document on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing document see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved document from
  // the API (i.e. the user is joining someone else's document, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDocument, setLoadedExistingDocument] = useState(false);
  // True when the URL points at a document that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [documentNotFound, setDocumentNotFound] = useState(false);
  // Distinct from documentNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the document first).
  const [loadingDocument, setLoadingDocument] = useState(true);

  // Local-session participant. Initialised to a stable placeholder so the
  // SSG output and the first client paint agree (Math.random() in a lazy
  // initialiser ran on both server and client and produced different
  // names, tripping React's hydration mismatch). The post-mount hydration
  // step below either loads a saved identity or mints a fresh random one
  // — both happen synchronously inside useLayoutEffect, so the user never
  // sees the placeholder.
  const [selfParticipant, setSelfParticipant] = useState<Participant>({
    id: 'self',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  // Who "I" am in a dot vote (docs/specs/012-collaboration/collab-race-hardening.md): the collab key, which is stable and
  // safe to publish, rather than the owner id, which is a guest's credential.
  const voteSelfId = participantKey(selfParticipant);

  // Dismissing a "shared with you" row lives in useDocumentListActions
  // (via useDocumentActions below), shared with /explorer and /new.
  // Tab ids whose full payload has been fetched. Hydration loads the
  // active tab inline; the rest pop in lazily when the user switches
  // to them. Tracked in a ref because it's only ever read inside the
  // effects, not rendered.
  const loadedTabIdsRef = useRef<Set<string>>(new Set());
  // Mirror of the ref above into reactive state, used by the JSX
  // gate that hides the template picker until the active tab's
  // content has actually been fetched. Without this the user sees
  // a "pick a template" flash on every fresh tab open: hydration
  // gives them the empty placeholder (elements.length === 0,
  // templateChosen unset), the picker renders, then the lazy fetch
  // resolves and the picker hides. Re-rendering on every change
  // would be wasteful; we only update this set after a
  // hydration / fetch lands, so the renders are bounded.
  const [loadedTabIds, setLoadedTabIds] = useState<Set<string>>(new Set());
  // Tab ids whose lazy fetch FAILED (network / 5xx — not a 404). Drives
  // the canvas's blocking error overlay so the user can't edit a blank
  // placeholder and have the autosave wipe the real server row (docs/specs/006-document/per-tab-storage.md).
  // `tabLoadRetryNonce` lets the Retry button re-run usePerTabLoad's
  // effect for the same active tab (deps otherwise unchanged).
  const [tabLoadErrors, setTabLoadErrors] = useState<Set<string>>(new Set());
  const [tabLoadRetryNonce, setTabLoadRetryNonce] = useState(0);
  // Mark a tab as loaded — its content is authoritative in local state,
  // so usePerTabLoad must skip it. Used by hydration and by the
  // locally-created tab paths (add / duplicate / import): those have no
  // server row to fetch yet, so without this they'd flash the loader
  // overlay (and never resolve, since the fetch 404s). Keeping them out
  // of the lazy-load path also makes the per-tab template picker fire
  // deterministically for a fresh tab.
  const markTabLoaded = (id: string) => {
    loadedTabIdsRef.current.add(id);
    setLoadedTabIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  // Persistent document id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [documentId, setDocumentId] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(false);

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / document rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // docs/specs/006-document/per-tab-storage.md has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');
  // Peer ops that land while a save is in flight (docs/specs/012-collaboration/collab-race-hardening.md); see save-baseline.
  const remoteOpJournalRef = useRef<RemoteOpJournal>(createRemoteOpJournal());
  // This editor's element writes the room has not sequenced yet (own-element-writes.ts): one stable object.
  const [ownWrites] = useState<OwnElementWrites>(createOwnElementWrites);
  // Peer ops applied to `tabs`, as state: the journal's count as of this render, for the autosave.
  const [opsApplied, setOpsApplied] = useState(0);
  const countAppliedOp = useCallback(() => setOpsApplied((n) => n + 1), []);

  // True while a hover-preview is on screen (set by useStylePreview). Style
  // previews mutate `tabs` via tickTabs so they render live, but they must
  // never be persisted — only the click-commit should. Autosave reads this
  // ref to skip the debounced save while a preview is showing.
  const previewingRef = useRef(false);

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);
  return {
    accountDisplayName,
    accountUserId,
    authLoaded,
    confirm,
    countAppliedOp,
    documentId,
    documentNotFound,
    embedMode,
    hydrated,
    initialTabs,
    lastPersistedSelfRef,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadError,
    loadedExistingDocument,
    loadedTabIds,
    loadedTabIdsRef,
    markTabLoaded,
    nameConfirmed,
    opsApplied,
    ownWrites,
    previewingRef,
    remoteOpJournalRef,
    selfParticipant,
    setDocumentId,
    setDocumentNotFound,
    setHydrated,
    setLoadError,
    setLoadedExistingDocument,
    setLoadedTabIds,
    setLoadingDocument,
    setNameConfirmed,
    setSelfParticipant,
    setTabLoadErrors,
    setTabLoadRetryNonce,
    tabLoadErrors,
    tabLoadRetryNonce,
    toast,
    voteSelfId,
    workbench,
    workbenchMode,
    view: {
      surface,
      workbenchMode,
      appChrome,
      workbench,
      // Whether sign-in has answered, so the start screen's switch never words a signed-in person as a guest.
      authLoaded,
      // The id the dot-vote knows us by (docs/specs/012-collaboration/collab-race-hardening.md): every vote reader compares
      // against this, never the owner id.
      voteSelfId,
      confirm,
      accountDisplayName,
      accountUserId,
      documentId,
      documentNotFound,
      loadError,
      embedMode,
      hydrated,
      loadedTabIds,
      loadingDocument,
      nameConfirmed,
      selfParticipant,
      // The Share dialog's "Sharing as" renames a guest.
      setSelfParticipant,
      setLoadingDocument,
      tabLoadErrors,
    },
  };
}

export type EditorDocumentSlice = ReturnType<typeof useEditorDocument>;
