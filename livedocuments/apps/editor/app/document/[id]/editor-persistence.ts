import { getOnline } from '@liveworkspace/workbench/lib/online-status';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

import { UNTITLED_DOCUMENT_NAME } from '@livedocuments/templates';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import type { useToast } from '@/hooks/ui/useToast';
import { SAVE_FORBIDDEN_MESSAGE, SAVE_SIGNED_OUT_MESSAGE } from './save-failure';

// Persistence-facing state for the editor: the autosave's status, the
// document name (mirrored into the browser tab title) and the transient import-error toast. The Explorer's lists
// are the index's, read by the shared Explorer itself. A cohesive slice lifted out of
// useEditorState — same pattern as usePanelLayout / useEditorDialogs.
//
// The setters are written by the autosave, hydration/bootstrap and room-op paths.
//
// The autosave's status and the time of its last write are held in refs, not state (docs/specs/007-editor/
// blueprints/flashcards.md "Performance and limits"): nothing draws them any more, only a failed save's toast reads
// the status, and as state each save rendered the whole editor twice more ('saving', then 'saved' and its time)
// after every typing commit. A move into a failed state raises its toast as it is set.
export function useEditorPersistence({ toast }: { toast: ReturnType<typeof useToast> }) {
  const saveStatusRef = useRef<SaveStatus>('idle');
  const savedAtRef = useRef<number | null>(null);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const setSaveStatus = useCallback((next: SetStateAction<SaveStatus>) => {
    const was = saveStatusRef.current;
    const now = typeof next === 'function' ? next(was) : next;
    saveStatusRef.current = now;
    if (now !== was) toastSaveFailure(now, toastRef.current);
  }, []);
  const setSavedAt = useCallback((next: SetStateAction<number | null>) => {
    savedAtRef.current = typeof next === 'function' ? next(savedAtRef.current) : next;
  }, []);
  const [documentName, setDocumentName] = useState(UNTITLED_DOCUMENT_NAME);
  // The stored slide deck (docs/specs/012-collaboration/presentation-mode.md) exactly as the api returned it, seeded on
  // load and never read again after useSlideDeck parses it. Kept as raw text
  // rather than a parsed Deck so hydration has one obvious moment, and a deck
  // the parser cannot read costs the deck rather than the document.
  const [documentPresentation, setDocumentPresentation] = useState<string | null>(null);
  // Reflect the document name in the browser tab so users with many
  // tabs open can spot the right one. Falls back to the bare brand
  // until hydration lands the real name.
  useEffect(() => {
    document.title = documentName ? `${documentName} | livedocuments` : 'livedocuments';
  }, [documentName]);

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

  return {
    setSaveStatus,
    setSavedAt,
    documentName,
    setDocumentName,
    documentPresentation,
    setDocumentPresentation,
    importError,
    setImportError,
  };
}

// A toast when an autosave fails (network / 5xx). Nothing else shows the 'error' status, and a failed save risks lost
// work, so it gets the bottom-centre toast. Raised on the move into a failed status; the toast layer dedupes a streak
// of retries while one is still on screen.
function toastSaveFailure(status: SaveStatus, toast: ReturnType<typeof useToast>): void {
  if (status === 'error') {
    // Offline, the cause is known and so is the way out (docs/specs/007-editor/load-recovery.md
    // "Offline"): the changes are only in this tab until the connection is back.
    toast.error(
      getOnline()
        ? 'Couldn’t save your changes. Check your connection.'
        : 'You’re offline. Keep this tab open to save when you reconnect.',
    );
  }
  // The network is fine here: the server couldn't tie the save to the
  // signed-in account. Blaming the connection sent people checking a cable.
  if (status === 'unauthenticated') {
    toast.error(SAVE_SIGNED_OUT_MESSAGE);
  }
  // A refusal, not a failure: retrying is pointless and the autosave has
  // already stopped, so this fires once and has to carry the whole message.
  // It names the likely cause and the way out, because the alternative is a
  // user who keeps working on changes that will never leave the browser.
  // Over the tab's row cap (docs/specs/006-document/per-tab-storage.md "A tab too big to save says so"): the
  // connection is fine, and only a smaller tab saves.
  if (status === 'tooLarge') {
    toast.error('This tab is too big to save. Move some of it to another tab.');
  }
  if (status === 'forbidden') {
    toast.error(SAVE_FORBIDDEN_MESSAGE);
  }
}
