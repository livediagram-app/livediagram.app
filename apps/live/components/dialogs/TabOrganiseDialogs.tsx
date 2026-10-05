'use client';

// The tab bar's two organise pickers as proper centred modals: "Add to
// Folder" (docs/specs/006-document/tab-folders.md — file the tab into a one-level tab-bar folder) and
// "Add to Document" (docs/specs/006-document/tab-document-many-to-many.md — link the tab into another document; the tab is
// shared, not copied). They used to be cramped sub-views squeezed inside the
// tab portal menu; the modal gives them the same tile-grid language as the
// shared placement browser (docs/specs/013-workspace/folders.md), with room to breathe and a filter for
// long document lists. Single-click commits — both are one-shot pickers.

import { lucideFolderX } from '@livediagram/icons/lucide';
import { useState } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import {
  FolderPlaceIcon,
  NewFolderTile,
  PlacementCard,
} from '@/components/placement/PlacementCard';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { lucideGlyph, useEscape } from '@livediagram/ui';
import { matches } from '@livediagram/icons';

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
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </Dialog>
  );
}

// The No Folder tile: a folder struck out.
const NoFolderIcon = lucideGlyph(lucideFolderX, 20);

// Add to Folder (docs/specs/006-document/tab-folders.md): a tile per existing tab folder, a No Folder tile
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
            // name = same folder, docs/specs/006-document/tab-folders.md) — exactly what the move does.
            onMoveToFolder(name);
            onClose();
            return Promise.resolve(true);
          }}
        />
      </div>
    </OrganiseDialogFrame>
  );
}

// A destination-document tile: the document's snapshot preview (docs/specs/006-document/document-snapshots.md) over
// its name, so the user picks by recognising the canvas rather than parsing
// a list of near-identical "Untitled document" names. Styled to match the
// PlacementCard tile grid, but its own component: the preview area is a
// full-width box, not the icon-glyph slot the shared card centres.
function DocumentPickCard({
  ownerId,
  document: liveDoc,
  onPick,
}: {
  ownerId: string | null;
  document: { id: string; name: string; savedAt?: number };
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-center transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
    >
      <DocumentThumbnail
        ownerId={ownerId}
        documentId={liveDoc.id}
        version={liveDoc.savedAt ?? 0}
        className="h-16 w-full rounded border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
      />
      <span className="w-full truncate text-xs font-medium text-slate-700 dark:text-slate-200">
        {liveDoc.name || 'Untitled document'}
      </span>
    </button>
  );
}

// Add to Document (docs/specs/006-document/tab-document-many-to-many.md): pick the destination document the tab is LINKED
// into (shared, not copied — one tab, live in both). A filter keeps long
// libraries manageable; picking commits immediately and closes.
export function AddTabToDocumentDialog({
  ownerId,
  otherDocuments,
  onPick,
  onClose,
}: {
  // Viewer identity for the authenticated thumbnail fetches.
  ownerId: string | null;
  otherDocuments: { id: string; name: string; savedAt?: number }[];
  onPick: (targetDocumentId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const visible = otherDocuments.filter(
    (d) => !query.trim() || matches(query, d.name || 'Untitled document'),
  );
  return (
    <OrganiseDialogFrame
      title="Add to Document"
      sub="Link this tab into another document. It stays one live tab: edits show in both places."
      onClose={onClose}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter documents…"
        aria-label="Filter documents"
        className="mb-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      {visible.length === 0 ? (
        <p className="px-1 py-8 text-center text-xs text-slate-400 dark:text-slate-400">
          No document matches.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((d) => (
            <DocumentPickCard
              key={d.id}
              ownerId={ownerId}
              document={d}
              onPick={() => {
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
