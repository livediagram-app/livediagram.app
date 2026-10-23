'use client';

// Use as Default for…: from a folder's menu, the entries of "New <kind> that open as", each a checkbox. It stays
// open after a choice, so several entries can be set in one visit; the checks follow the store at once. A key
// points at one folder, so checking an entry here takes it from whichever folder held it.

import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { useExplorer } from '../explorer/context';

export function UseAsDefaultDialog({
  folderId,
  onClose,
}: {
  folderId: string;
  onClose: () => void;
}) {
  const { folders, defaults, defaultEntries, kind, openDialog } = useExplorer();
  const folder = folders.byId.get(folderId);
  if (!folder) return null;
  const ready = defaults.status === 'ready';
  return (
    <Dialog onClose={onClose} ariaLabel={`Use “${folder.name}” as Default for`} size="sm">
      <DialogHeader
        title={`Use “${folder.name}” as Default for`}
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
            const checked = defaults.defaults.get(entry.key) === folder.id;
            return (
              <li key={entry.key}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    disabled={!ready}
                    checked={checked}
                    onChange={() =>
                      void (checked
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
