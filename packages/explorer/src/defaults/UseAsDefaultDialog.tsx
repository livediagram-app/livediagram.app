'use client';

// Use as Default for…: from a folder's menu, the entries of "New <kind> that open as", each a checkbox. It stays
// open after a choice, so several entries can be set in one visit; the checks follow the store at once. A key
// points at one folder, so checking an entry here takes it from whichever folder held it.
//
// From My Work's own menu (folderId null) the same entries speak for the root of My Work, where a create lands
// without a default: an entry is checked while its key has no working default (none, or one whose folder is
// gone), and is then unavailable; checking another clears its default, sending those back to the root. A team's
// root is never a default.

import { Button } from '@liveworkspace/ui';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { useExplorer } from '../explorer/context';
import { SIDEBAR_LABELS } from '../views';
import { quoted } from '../quoted';

export function UseAsDefaultDialog({
  folderId,
  onClose,
}: {
  folderId: string | null;
  onClose: () => void;
}) {
  const { folders, defaults, defaultEntries, kind, openDialog } = useExplorer();
  const folder = folderId === null ? null : folders.byId.get(folderId);
  if (folderId !== null && !folder) return null;
  const name = folder ? folder.name : SIDEBAR_LABELS.myWork;
  const ready = defaults.status === 'ready';
  // Whether a key's default points at a folder still there (a dangling one files at the root).
  const working = (key: string) => {
    const at = defaults.defaults.get(key);
    return at !== undefined && folders.byId.has(at);
  };
  return (
    <Dialog onClose={onClose} ariaLabel={`Use ${quoted(name)} as Default for`} size="sm">
      <DialogHeader
        title={`Use ${quoted(name)} as Default for`}
        subtitle={`New ${kind.lowerMany} you make without choosing a place are saved in your default folder.`}
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <fieldset className="px-6 py-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          New {kind.lowerMany} that open as
        </legend>
        {defaults.status === 'failed' ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            Couldn’t load your default folders.
          </p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {defaultEntries.map((entry) => {
            const checked = folder
              ? defaults.defaults.get(entry.key) === folder.id
              : !working(entry.key);
            // At the root a checked entry is already the root's: nothing to undo there.
            const locked = !folder && checked;
            return (
              <li key={entry.key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    disabled={!ready || locked}
                    checked={checked}
                    onChange={() =>
                      void (checked || !folder
                        ? defaults.clear(entry.key)
                        : defaults.set(entry.key, folder.id))
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  {entry.label}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <DialogFooter>
        <Button
          variant="secondary"
          size="sm"
          className="mr-auto"
          onClick={() => openDialog({ kind: 'default-folders' })}
        >
          All Default Folders
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
