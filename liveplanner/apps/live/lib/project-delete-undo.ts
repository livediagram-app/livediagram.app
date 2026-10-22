// A project delete asks nothing first (docs/specs/013-workspace/trash.md "Deleting"): it only moves the project to
// the Trash, so the "“Roadmap” deleted" toast carries an Undo that restores it from there, the same everywhere.
import { apiRestoreProject } from '@/lib/api/trash';
import { track } from '@/lib/telemetry';
import { toastName } from '@/lib/toast-name';
import {
  projectDeletedMessage,
  projectRestoreFailedMessage,
  projectRestoredMessage,
} from '@/lib/project-toast-copy';
import type { useToast } from '@/hooks/ui/useToast';
import type { LiveDoc } from '@liveplanner/api-schema';

/** Which Trash a deleted project went to, as the Trash's own telemetry types it. */
export type DeletedTrash = 'Personal' | 'Team' | 'Local';

/**
 * Say a project was deleted, with an Undo that restores it. `onRestored` gets the project back (null for an
 * offline one, which the caller re-lists) so the list can put its row back.
 */
export function offerDeleteUndo(
  toast: ReturnType<typeof useToast>,
  at: {
    ownerId: string;
    id: string;
    name?: string | null;
    trash: DeletedTrash;
    onRestored?: (doc: LiveDoc | null) => void;
  },
): void {
  const key = `project-deleted:${at.id}`;
  toast.action({
    key,
    message: projectDeletedMessage(at.name),
    actions: [
      {
        label: 'Undo',
        ariaLabel: `Undo: restore ${toastName(at.name) ?? 'the project'}`,
        onSelect: () => {
          toast.dismissAction(key);
          void apiRestoreProject(at.ownerId, at.id).then(
            (doc) => {
              track('Trash', 'Restored', at.trash);
              at.onRestored?.(doc);
              toast.success(projectRestoredMessage(at.name));
            },
            () => toast.error(projectRestoreFailedMessage(at.name)),
          );
        },
      },
    ],
  });
}

// The open project's delete leaves the editor for the Explorer, so its Undo is handed over: the Explorer offers it
// on arrival. Held for one page load in sessionStorage, and only for a moment, so a later visit offers nothing.
const HANDOFF_KEY = 'liveplanner:deleted-project';
const HANDOFF_MAX_AGE_MS = 30_000;

type Handoff = { id: string; name?: string; trash: DeletedTrash; at: number };

export function handOffDeleteUndo(
  id: string,
  trash: DeletedTrash,
  name?: string | null,
  now = Date.now(),
): void {
  try {
    const handoff: Handoff = { id, trash, at: now, ...(name ? { name } : {}) };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage off: the project is still in the Trash.
  }
}

/** The handed-over delete, taken (read once and cleared); null when there is none or it is stale. */
export function takeDeleteUndo(
  now = Date.now(),
): { id: string; name: string | null; trash: DeletedTrash } | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    const h = JSON.parse(raw) as Partial<Handoff>;
    if (typeof h.id !== 'string' || typeof h.at !== 'number') return null;
    if (h.trash !== 'Personal' && h.trash !== 'Team' && h.trash !== 'Local') return null;
    if (now - h.at > HANDOFF_MAX_AGE_MS || now < h.at) return null;
    return { id: h.id, name: typeof h.name === 'string' ? h.name : null, trash: h.trash };
  } catch {
    return null;
  }
}
