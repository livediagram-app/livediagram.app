'use client';

// The tab bar's two organise pickers as proper centred modals: "Add to
// Folder" (docs/specs/006-document/tab-folders.md — file the tab into a one-level tab-bar folder) and
// "Add to Document" (docs/specs/006-document/tab-document-many-to-many.md — link the tab into another document; the tab is
// shared, not copied). They used to be cramped sub-views squeezed inside the
// tab portal menu; the modal gives them the same tile-grid language as the
// shared placement browser (docs/specs/013-workspace/folders.md), with room to breathe and a filter for
// long document lists. Single-click commits — both are one-shot pickers.

import { addToAnotherHeroArt } from '@liveworkspace/ui/dialog-hero-art/add-to-another';
import { lucideFolderX } from '@liveworkspace/icons/lucide';
import { useState } from 'react';
import { OrganiseDialogFrame } from '@liveworkspace/workbench/components/dialogs/OrganiseDialogFrame';
import { tabFolderHeroArt } from '@liveworkspace/ui/dialog-hero-art/tab-folder';
import {
  FolderPlaceIcon,
  NewFolderTile,
  PlacementCard,
} from '@/components/placement/PlacementCard';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { CompactEmptyState, NoMatches, lucideGlyph } from '@liveknowledge/ui';
import { DocumentIcon } from '@/components/primitives/explorer-icons';
import { matches } from '@liveworkspace/icons';

// The No Folder tile: a folder struck out.
const NoFolderIcon = lucideGlyph(lucideFolderX, 20);

// Organise in Tab Folder (docs/specs/006-document/tab-folders.md): the create-in-place New Folder tile first, a No
// Folder tile (the loose end of the bar), and a tile per existing tab folder.
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
      art={tabFolderHeroArt}
      title="Organise in Tab Folder"
      sub="File this tab into a folder on the tab bar. Same name means same folder."
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <NewFolderTile
          onCreate={(name) => {
            // Typing an existing name just moves the tab into it (same
            // name = same folder, docs/specs/006-document/tab-folders.md): exactly what the move does.
            onMoveToFolder(name);
            onClose();
            return Promise.resolve(true);
          }}
        />
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
      </div>
    </OrganiseDialogFrame>
  );
}

// A destination-document tile: the document's snapshot preview (docs/specs/006-document/document-snapshots.md) over
// its name, so the user picks by recognising the canvas rather than parsing
// a list of near-identical "Untitled Knowledgebase" names. Styled to match the
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
        {liveDoc.name || 'Untitled Knowledgebase'}
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
    (d) => !query.trim() || matches(query, d.name || 'Untitled Knowledgebase'),
  );
  return (
    <OrganiseDialogFrame
      art={addToAnotherHeroArt}
      title="Add to Knowledgebase"
      sub="Link this page into another knowledgebase. It stays one live page: edits show in both places."
      onClose={onClose}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter knowledgebases…"
        aria-label="Filter knowledgebases"
        className="mb-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      {visible.length === 0 ? (
        query.trim() ? (
          <NoMatches
            size="regular"
            className="py-8"
            things="documents"
            query={query}
            onClear={() => setQuery('')}
          />
        ) : (
          <CompactEmptyState
            className="py-8"
            icon={<DocumentIcon />}
            title="No other knowledgebases yet"
            description="Make another knowledgebase to add this page to it."
          />
        )
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
