'use client';

import { useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { MenuTile, MenuTileGrid, PortalMenu } from '@/components/primitives/PortalMenu';
import { DiagramIcon, MenuFolderIcon, PlusIcon } from '@/app/explorer/icons';
import { ViewToggle } from '@/app/explorer/ViewToggle';
import type { ExplorerViewMode } from '@/app/explorer/useExplorerViewMode';
import type { Folder } from '@livediagram/api-schema';

// The bar above the team library (spec/35): where you are, and the two things
// you can do from anywhere in it — switch card / list view, and add something.
//
// Split out of TeamSharedDiagrams because it is the half of that component
// that has nothing to do with listing diagrams. Below it is a folder tree and
// its rows; this is navigation and creation, and the two only meet through the
// current spot.

export type TeamLibraryCrumb = { label: string; onClick?: () => void };

export function TeamLibraryHeader({
  crumbs,
  teamId,
  currentFolderId,
  inFolder,
  viewMode,
  setViewMode,
  createFolder,
  setRenamingFolderId,
}: {
  /** Root-first trail; the last entry is where you are and never links. */
  crumbs: TeamLibraryCrumb[];
  teamId: string;
  /** The folder a new diagram or subfolder lands in, or null at the root. */
  currentFolderId: string | null;
  /** Whether the current spot is a folder, so the tile reads "New subfolder". */
  inFolder: boolean;
  viewMode: ExplorerViewMode;
  setViewMode: (mode: ExplorerViewMode) => void;
  createFolder: (parentId: string | null, name?: string) => Promise<Folder | undefined>;
  setRenamingFolderId: (id: string | null) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
      <nav aria-label="Team folders" className="flex min-w-0 flex-wrap items-center text-xs">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex items-center">
              {i > 0 ? (
                <span aria-hidden className="px-1 text-slate-300 dark:text-slate-600">
                  ›
                </span>
              ) : null}
              {c.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={c.onClick}
                  className="rounded px-1 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                >
                  {c.label}
                </button>
              ) : (
                // The section-label uppercase look is reserved for the
                // root "Shared diagrams" crumb; deeper crumbs are user
                // folder names and must keep their own casing.
                <span
                  className={
                    i === 0
                      ? 'px-1 py-0.5 font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'
                      : 'px-1 py-0.5 font-semibold text-slate-700 dark:text-slate-200'
                  }
                >
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <div className="relative">
          <Button
            ref={createRef}
            onClick={() => setCreateOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={createOpen}
            size="xs"
            // Keeps the panel header's compact chip density: the extra
            // classes append after the size scale, so they win.
            className="shrink-0 gap-1.5 px-2 py-1 text-[11px] shadow-sm"
          >
            <PlusIcon />
            Create
            <svg
              width="9"
              height="9"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="-mr-0.5"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </Button>
          {createOpen ? (
            <PortalMenu
              anchor={createRef.current}
              placement="below"
              onClose={() => setCreateOpen(false)}
            >
              <MenuTileGrid cols={2}>
                {/* New diagram lands directly in the team library, scoped
                to the folder currently open (spec/35): /live/new
                applies the team + folder placement after the create. */}
                <MenuTile
                  icon={
                    <span className="[&_svg]:h-5 [&_svg]:w-5">
                      <DiagramIcon />
                    </span>
                  }
                  label="New diagram"
                  onClick={() => {
                    setCreateOpen(false);
                    window.location.assign(
                      `/new?team=${encodeURIComponent(teamId)}${
                        currentFolderId ? `&folder=${encodeURIComponent(currentFolderId)}` : ''
                      }`,
                    );
                  }}
                />
                <MenuTile
                  icon={
                    <span className="[&_svg]:h-5 [&_svg]:w-5">
                      <MenuFolderIcon />
                    </span>
                  }
                  label={inFolder ? 'New subfolder' : 'New folder'}
                  onClick={() => {
                    setCreateOpen(false);
                    void createFolder(currentFolderId).then((created) => {
                      if (created) setRenamingFolderId(created.id);
                    });
                  }}
                />
              </MenuTileGrid>
            </PortalMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
}
