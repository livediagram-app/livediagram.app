'use client';

// The tab bar's two organise pickers as proper centred modals: "Add to
// Folder" (spec/30 — file the tab into a one-level tab-bar folder) and
// "Add to Diagram" (spec/17 — link the tab into another diagram; the tab is
// shared, not copied). They used to be cramped sub-views squeezed inside the
// tab portal menu; the modal gives them the same tile-grid language as the
// shared placement browser (spec/15), with room to breathe and a filter for
// long diagram lists. Single-click commits — both are one-shot pickers.

import { useState } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import {
  FolderPlaceIcon,
  NewFolderTile,
  PlacementCard,
} from '@/components/placement/PlacementBrowser';
import { useEscape } from '@/hooks/ui/useEscape';
import { matches } from '@/lib/search';

// Shared modal frame: header (title + sub + close) over a scrollable body.
function OrganiseDialogFrame({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Capture-phase Esc so this wins over the editor's global shortcuts; the
  // Dialog shell's own (bubble-phase) Esc is suppressed via closeOnEscape.
  useEscape(onClose, { capture: true, stopPropagation: true });
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </Dialog>
  );
}

// A "loose tabs" glyph for the No Folder tile — a bar of tab pills.
function NoFolderIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="8" width="5" height="4" rx="1.2" />
      <rect x="9" y="8" width="5" height="4" rx="1.2" />
      <path d="M15.5 8h2v4h-2" />
    </svg>
  );
}

// Add to Folder (spec/30): a tile per existing tab folder, a No Folder tile
// (the loose end of the bar), and the create-in-place New Folder tile.
// Picking commits immediately and closes — one-level folders need no browse.
export function AddTabToFolderDialog({
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onClose,
}: {
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onClose: () => void;
}) {
  return (
    <OrganiseDialogFrame
      title="Add to Folder"
      sub="File this tab into a folder on the tab bar. Same name means same folder."
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <PlacementCard
          label="No Folder"
          sub={currentFolder === null ? 'Current' : 'Loose on the bar'}
          icon={<NoFolderIcon />}
          selected={currentFolder === null}
          onSelect={() => {
            if (currentFolder !== null) onRemoveFromFolder();
            onClose();
          }}
        />
        {folderNames.map((name) => (
          <PlacementCard
            key={name}
            label={name}
            sub={name === currentFolder ? 'Current' : 'Folder'}
            icon={<FolderPlaceIcon />}
            selected={name === currentFolder}
            onSelect={() => {
              if (name !== currentFolder) onMoveToFolder(name);
              onClose();
            }}
          />
        ))}
        <NewFolderTile
          onCreate={(name) => {
            // Typing an existing name just moves the tab into it (same
            // name = same folder, spec/30) — exactly what the move does.
            onMoveToFolder(name);
            onClose();
            return Promise.resolve(true);
          }}
        />
      </div>
    </OrganiseDialogFrame>
  );
}

// A document-ish diagram glyph sized for the tile grid.
function DiagramTileIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <rect x="6" y="6.5" width="4" height="3" rx="0.8" />
      <path d="M10 8h4M12 8v4.5" />
      <rect x="10" y="11.5" width="4" height="3" rx="0.8" />
    </svg>
  );
}

// Add to Diagram (spec/17): pick the destination diagram the tab is LINKED
// into (shared, not copied — one tab, live in both). A filter keeps long
// libraries manageable; picking commits immediately and closes.
export function AddTabToDiagramDialog({
  otherDiagrams,
  onPick,
  onClose,
}: {
  otherDiagrams: { id: string; name: string }[];
  onPick: (targetDiagramId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const visible = otherDiagrams.filter(
    (d) => !query.trim() || matches(query, d.name || 'Untitled diagram'),
  );
  return (
    <OrganiseDialogFrame
      title="Add to Diagram"
      sub="Link this tab into another diagram. It stays one live tab: edits show in both places."
      onClose={onClose}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter diagrams…"
        aria-label="Filter diagrams"
        className="mb-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {visible.length === 0 ? (
        <p className="px-1 py-8 text-center text-xs text-slate-400 dark:text-slate-400">
          No diagram matches.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((d) => (
            <PlacementCard
              key={d.id}
              label={d.name || 'Untitled diagram'}
              sub="Diagram"
              icon={<DiagramTileIcon />}
              selected={false}
              onSelect={() => {
                onPick(d.id);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </OrganiseDialogFrame>
  );
}
