import type { ItemTypeCatalogue } from '@livediagram/items';
import { getOnline } from '@/lib/online-status';
import { useEffect, useState } from 'react';

import { UNTITLED_DOCUMENT_NAME } from '@livediagram/templates';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import type { useToast } from '@/hooks/ui/useToast';
import {
  apiListDocuments,
  apiListSharedWith,
  type DocumentListItem,
  type SharedWithItem,
  DOCUMENT_LIST_LOAD_SAFETY_MS,
} from '@/lib/api-client';

// Persistence-facing state for the editor: the autosave status pill, the
// document name (mirrored into the browser tab title), the Explorer's
// owned + shared document lists, and the transient import-error toast. Plus the two list-refresh helpers the
// hydration + autosave paths call. A cohesive slice lifted out of
// useEditorState — same pattern as usePanelLayout / useEditorDialogs.
//
// The values render the header pill, footer "Saved X ago", Explorer
// lists; the setters are written by the autosave,
// hydration/bootstrap and room-op paths via the returned setters.
export function useEditorPersistence({ toast }: { toast: ReturnType<typeof useToast> }) {
  // Surfaced in the footer (bottom-right of the TabBar). The autosave
  // used to swallow errors silently which made an offline API look
  // identical to a successful save; the indicator below makes the
  // result visible. `savedAt` is the epoch ms of the last successful
  // write — drives the "Saved 2 minutes ago" relative-time string.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState(UNTITLED_DOCUMENT_NAME);
  // The stored slide deck (docs/specs/012-collaboration/presentation-mode.md) exactly as the api returned it, seeded on
  // load and never read again after useSlideDeck parses it. Kept as raw text
  // rather than a parsed Deck so hydration has one obvious moment, and a deck
  // the parser cannot read costs the deck rather than the document.
  const [documentPresentation, setDocumentPresentation] = useState<string | null>(null);
  // The document's type catalogue (docs/specs/026-plan/item-types.md), null for the default types:
  // seeded on load, then set by a save here or the room's `item-types` op. See useItemTypes.
  const [documentItemTypes, setDocumentItemTypes] = useState<ItemTypeCatalogue | null>(null);
  // Reflect the document name in the browser tab so users with many
  // tabs open can spot the right one. Falls back to the bare brand
  // until hydration lands the real name.
  useEffect(() => {
    document.title = documentName ? `${documentName} | livediagram` : 'livediagram';
  }, [documentName]);

  // Every document in the local store. Used by the Explorer to render its
  // list. Refreshed on hydration and after we save the current document
  // (so the Explorer's "Your documents" section reflects renames + first
  // saves in real time).
  const [documentList, setDocumentList] = useState<DocumentListItem[]>([]);
  // True while the very first document-list fetch is in flight, so the
  // Explorer can render a skeleton instead of an empty "no documents"
  // state. We only flip this off — subsequent refreshes don't reset it
  // because they're triggered by saves and shouldn't blank the list.
  const [documentListLoading, setDocumentListLoading] = useState(true);
  // Documents shared with the current owner. Surfaced in the
  // Explorer's "Shared with you" accordion. Fetched alongside the
  // owned-document list and refreshed when the owner opens a new
  // share link in this tab.
  const [sharedDocuments, setSharedDocuments] = useState<SharedWithItem[]>([]);
  // Brief error string surfaced by the Import-tab flow when the
  // picked file is malformed or its schema is newer than this
  // editor understands. Rendered as a transient toast under the
  // header — auto-clears after 6 seconds so the user isn't stuck
  // looking at it, and gets cleared on the next import attempt.
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!importError) return;
    const id = window.setTimeout(() => setImportError(null), 6000);
    return () => window.clearTimeout(id);
  }, [importError]);

  // Surface a toast when an autosave fails (network / 5xx). Nothing else
  // shows the 'error' status, and a failed save risks lost work, so it
  // gets the bottom-centre toast. Fires on the transition into 'error';
  // the toast layer dedupes a streak of retries while one is still on screen.
  useEffect(() => {
    if (saveStatus === 'error') {
      // Offline, the cause is known and so is the way out (docs/specs/007-editor/load-recovery.md
      // "Offline"): the changes are only in this tab until the connection is back.
      toast.error(
        getOnline()
          ? 'Couldn’t save your changes. Check your connection.'
          : 'You’re offline. Your changes will save when you reconnect. Keep this tab open.',
      );
    }
    // The network is fine here: the server couldn't tie the save to the
    // signed-in account. Blaming the connection sent people checking a cable.
    if (saveStatus === 'unauthenticated') {
      toast.error(
        'Couldn’t confirm you’re signed in, so your changes aren’t saving. Sign in again to keep them.',
      );
    }
    // A refusal, not a failure: retrying is pointless and the autosave has
    // already stopped, so this fires once and has to carry the whole message.
    // It names the likely cause and the way out, because the alternative is a
    // user who keeps working on changes that will never leave the browser.
    if (saveStatus === 'forbidden') {
      toast.error(
        'You no longer have permission to edit this document, so your recent changes aren’t being saved. Export a copy to keep them.',
      );
    }
  }, [saveStatus, toast]);

  // Document-list refresh, fired after every autosave so the
  // Explorer's "Updated X ago" timestamps stay fresh. Folders are
  // explicitly NOT refetched here — they only change via folder
  // mutations (create / rename / delete / move) which manage state
  // optimistically themselves. Pulling them every save spammed
  // /api/folders on every edit.
  const refreshDocumentList = (ownerId: string) => {
    const safety = window.setTimeout(
      () => setDocumentListLoading(false),
      DOCUMENT_LIST_LOAD_SAFETY_MS,
    );
    apiListDocuments(ownerId)
      .then((list) => {
        window.clearTimeout(safety);
        setDocumentList(list);
        setDocumentListLoading(false);
      })
      .catch(() => {
        // Network glitch — the next save will retry. List staleness
        // for a beat is acceptable; we don't want a transient error
        // to wipe the rendered list. Drop the loading flag so the
        // Explorer doesn't spin forever on a dead network.
        window.clearTimeout(safety);
        setDocumentListLoading(false);
      });
    // Shared-with-you is deliberately NOT fetched here. The list
    // only changes when the user opens a NEW share URL (which
    // navigates the page → hydration picks it up) or when the
    // owner revokes shares (which the visitor won't see until
    // their next page load anyway). Fetching it on every
    // autosave-triggered refresh was burning a wasted GET
    // /api/shared per ~500ms of active editing.
  };
  // One-shot shared-list fetch, called from the hydration IIFE
  // alongside refreshDocumentList. Silent failure: the section
  // hides when empty so a network glitch just leaves the
  // accordion absent for this session.
  const refreshSharedList = (ownerId: string) => {
    apiListSharedWith(ownerId)
      .then((items) => setSharedDocuments(items))
      .catch(() => {});
  };

  return {
    saveStatus,
    setSaveStatus,
    savedAt,
    setSavedAt,
    documentName,
    setDocumentName,
    documentPresentation,
    setDocumentPresentation,
    documentItemTypes,
    setDocumentItemTypes,
    documentList,
    setDocumentList,
    documentListLoading,
    setDocumentListLoading,
    sharedDocuments,
    setSharedDocuments,
    importError,
    setImportError,
    refreshDocumentList,
    refreshSharedList,
  };
}
