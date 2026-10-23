import type { SavedItemTypes } from '@/lib/api/item-types';
import { getOnline } from '@/lib/online-status';
import { useEffect, useState } from 'react';

import { UNTITLED_PROJECT_NAME } from '@liveplanner/templates';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import type { useToast } from '@/hooks/ui/useToast';

// Persistence-facing state for the editor: the autosave status pill, the
// project name (mirrored into the browser tab title) and the transient import-error toast. The Explorer's lists
// are the index's, read by the shared Explorer itself. A cohesive slice lifted out of
// useEditorState — same pattern as usePanelLayout / useEditorDialogs.
//
// The values render the header pill and the footer "Saved X ago"; the setters are written by the autosave,
// hydration/bootstrap and room-op paths via the returned setters.
export function useEditorPersistence({ toast }: { toast: ReturnType<typeof useToast> }) {
  // Surfaced in the footer (bottom-right of the TabBar). The autosave
  // used to swallow errors silently which made an offline API look
  // identical to a successful save; the indicator below makes the
  // result visible. `savedAt` is the epoch ms of the last successful
  // write — drives the "Saved 2 minutes ago" relative-time string.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [projectName, setProjectName] = useState(UNTITLED_PROJECT_NAME);
  // The project's type catalogue as stored (docs/specs/026-plan/item-types.md), null for the default
  // types, with its revision: seeded on load, then set by a save here or the room's `item-types` op.
  // See useItemTypes, which shows this editor's unsaved changes over it.
  const [projectItemTypes, setProjectItemTypes] = useState<SavedItemTypes>({
    itemTypes: null,
    itemTypesRev: 0,
  });
  // Reflect the project name in the browser tab so users with many
  // tabs open can spot the right one. Falls back to the bare brand
  // until hydration lands the real name.
  useEffect(() => {
    document.title = projectName ? `${projectName} | liveplanner` : 'liveplanner';
  }, [projectName]);

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
          : 'You’re offline. Keep this tab open to save when you reconnect.',
      );
    }
    // The network is fine here: the server couldn't tie the save to the
    // signed-in account. Blaming the connection sent people checking a cable.
    if (saveStatus === 'unauthenticated') {
      toast.error('Your sign-in has lapsed, so changes aren’t saving. Sign in again.');
    }
    // A refusal, not a failure: retrying is pointless and the autosave has
    // already stopped, so this fires once and has to carry the whole message.
    // It names the likely cause and the way out, because the alternative is a
    // user who keeps working on changes that will never leave the browser.
    // Over the tab's row cap (docs/specs/006-project/per-tab-storage.md "A tab too big to save says so"): the
    // connection is fine, and only a smaller tab saves.
    if (saveStatus === 'tooLarge') {
      toast.error('This tab is too big to save. Move some of it to another tab.');
    }
    if (saveStatus === 'forbidden') {
      toast.error('You can no longer edit this. Export a copy to keep your changes.');
    }
  }, [saveStatus, toast]);

  return {
    saveStatus,
    setSaveStatus,
    savedAt,
    setSavedAt,
    projectName,
    setProjectName,
    projectItemTypes,
    setProjectItemTypes,
    importError,
    setImportError,
  };
}
