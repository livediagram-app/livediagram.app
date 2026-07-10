import { useState } from 'react';
import {
  BackIcon,
  DiagramIcon,
  FolderMenuIcon,
  FolderRemoveIcon,
} from '@/components/chrome/tab-bar-icons';
import { MenuItem } from '@/components/primitives/PortalMenu';

// The tab portal menu's two sub-views, lifted out of TabPortalMenu:
// "Add to Diagram" (pick a destination diagram to link the tab into,
// spec/17 — the tab is shared, not copied) and
// "Add to Folder" (spec/30 — file the tab into a one-level folder).
// Both render inside the same portal box; the host keeps the view
// switch so the positioning and outside-click handling stay put.

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
    >
      <BackIcon />
      Back
    </button>
  );
}

export function TabMenuCopyToView({
  otherDiagrams,
  onCopyTo,
  onBack,
}: {
  otherDiagrams: { id: string; name: string }[];
  onCopyTo: (targetDiagramId: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <BackRow onBack={onBack} />
      <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-400">
        Pick a destination diagram
      </p>
      <div className="max-h-56 overflow-y-auto">
        {otherDiagrams.map((d) => (
          <MenuItem
            key={d.id}
            icon={<DiagramIcon />}
            label={d.name || 'Untitled diagram'}
            onClick={() => onCopyTo(d.id)}
          />
        ))}
      </div>
    </>
  );
}

export function TabMenuFolderView({
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onBack,
}: {
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onBack: () => void;
}) {
  // New-folder input. Local to the view: it mounts fresh each time the
  // user enters this sub-view, so the field always starts empty.
  const [newFolder, setNewFolder] = useState('');
  return (
    <>
      <BackRow onBack={onBack} />
      <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-400">
        Add this tab to a folder
      </p>
      {/* New-folder inline input: Enter (or the + button) commits.
          Typing an existing name just moves the tab into it
          (same name = same folder, spec/30). */}
      <form
        className="flex items-center gap-1 px-2 pb-1"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newFolder.trim();
          if (name) onMoveToFolder(name);
        }}
      >
        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="New folder…"
          aria-label="New folder name"
          className="min-w-0 flex-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 outline-none ring-brand-300 focus:ring-1 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          aria-label="Create folder"
          disabled={!newFolder.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          +
        </button>
      </form>
      {folderNames.length > 0 ? (
        <div className="max-h-44 overflow-y-auto border-t border-slate-100 pt-1 dark:border-slate-800">
          {folderNames.map((name) => (
            <MenuItem
              key={name}
              icon={<FolderMenuIcon />}
              label={name === currentFolder ? `${name} (current)` : name}
              onClick={() => onMoveToFolder(name)}
              disabled={name === currentFolder}
            />
          ))}
        </div>
      ) : null}
      {currentFolder ? (
        <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
          <MenuItem
            icon={<FolderRemoveIcon />}
            label="Remove from folder"
            onClick={onRemoveFromFolder}
          />
        </div>
      ) : null}
    </>
  );
}
