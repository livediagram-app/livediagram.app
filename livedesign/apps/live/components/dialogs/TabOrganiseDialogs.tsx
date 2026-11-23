'use client';

// The tab menu's picker for linking the tab into another design (docs/specs/006-design/tab-design-many-to-many.md: the tab is
// shared, not copied) as a centred modal, in the frame every organise modal shares, with a filter for long lists.
// Picking commits and closes. Organise in Tab Folder is the workbench's, one copy for every editor
// (@liveworkspace/workbench TabFolderDialog, docs/specs/006-design/tab-folders.md).

import { addToAnotherHeroArt } from '@liveworkspace/ui/dialog-hero-art/add-to-another';
import { useState } from 'react';
import { OrganiseDialogFrame } from '@liveworkspace/workbench/components/dialogs/OrganiseDialogFrame';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';
import { CompactEmptyState, NoMatches } from '@livedesign/ui';
import { DesignIcon } from '@/components/primitives/explorer-icons';
import { matches } from '@liveworkspace/icons';

// A destination-design tile: the design's snapshot preview (docs/specs/006-design/design-snapshots.md) over
// its name, so the user picks by recognising the canvas rather than parsing
// a list of near-identical "Untitled design" names. Styled to match the
// PlacementCard tile grid, but its own component: the preview area is a
// full-width box, not the icon-glyph slot the shared card centres.
function DesignPickCard({
  ownerId,
  design: liveDoc,
  onPick,
}: {
  ownerId: string | null;
  design: { id: string; name: string; savedAt?: number };
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-center transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
    >
      <DesignThumbnail
        ownerId={ownerId}
        designId={liveDoc.id}
        version={liveDoc.savedAt ?? 0}
        className="h-16 w-full rounded border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
      />
      <span className="w-full truncate text-xs font-medium text-slate-700 dark:text-slate-200">
        {liveDoc.name || 'Untitled design'}
      </span>
    </button>
  );
}

// Add to Design (docs/specs/006-design/tab-design-many-to-many.md): pick the destination design the tab is LINKED
// into (shared, not copied — one tab, live in both). A filter keeps long
// libraries manageable; picking commits immediately and closes.
export function AddTabToDesignDialog({
  ownerId,
  otherDesigns,
  onPick,
  onClose,
}: {
  // Viewer identity for the authenticated thumbnail fetches.
  ownerId: string | null;
  otherDesigns: { id: string; name: string; savedAt?: number }[];
  onPick: (targetDesignId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const visible = otherDesigns.filter(
    (d) => !query.trim() || matches(query, d.name || 'Untitled design'),
  );
  return (
    <OrganiseDialogFrame
      art={addToAnotherHeroArt}
      title="Add to Design"
      sub="Link this tab into another design. It stays one live tab: edits show in both places."
      onClose={onClose}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter designs…"
        aria-label="Filter designs"
        className="mb-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      {visible.length === 0 ? (
        query.trim() ? (
          <NoMatches
            size="regular"
            className="py-8"
            things="designs"
            query={query}
            onClear={() => setQuery('')}
          />
        ) : (
          <CompactEmptyState
            className="py-8"
            icon={<DesignIcon />}
            title="No other designs yet"
            description="Make another design to add this tab to it."
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((d) => (
            <DesignPickCard
              key={d.id}
              ownerId={ownerId}
              design={d}
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
