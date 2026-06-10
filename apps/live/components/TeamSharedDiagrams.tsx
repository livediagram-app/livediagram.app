'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { DiagramSummary, Folder } from '@livediagram/api-schema';
import { FolderRow, UnsortedRow } from '@/app/explorer/views';
import { MenuFolderIcon, PlusIcon } from '@/app/explorer/icons';
import { DiagramIcon, EllipsisIcon, MenuTrashIcon } from '@/app/explorer/icons';
import { MenuItem, PortalMenu } from './PortalMenu';
import { useConfirm } from '@/hooks/useConfirm';
import { useTeamLibrary } from '@/hooks/useTeamLibrary';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';

// "Shared diagrams" on the team page (spec/35): the team's folder
// tree + diagrams, navigated with a small breadcrumb instead of a
// sidebar. The concept (and most of the row components) is the
// personal explorer's, just team-scoped: every joined member can
// create / rename / move / delete folders, re-folder diagrams, and
// remove a diagram from the team (back to its owner's personal
// Unsorted). The Unsorted bucket is synthetic and undeletable, same
// as the personal tree.

type Spot = { kind: 'root' } | { kind: 'unsorted' } | { kind: 'folder'; id: string };

export function TeamSharedDiagrams({ ownerId, teamId }: { ownerId: string; teamId: string }) {
  const lib = useTeamLibrary(ownerId, teamId);
  const [spot, setSpot] = useState<Spot>({ kind: 'root' });
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'diagram'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);
  const confirm = useConfirm();
  useRelativeTimeTick();

  const unsorted = lib.diagramsByFolder.get(null) ?? [];
  const currentFolderId = spot.kind === 'folder' ? spot.id : null;
  const visibleFolders =
    spot.kind === 'root'
      ? lib.rootFolders
      : spot.kind === 'folder'
        ? (lib.childrenByParent.get(spot.id) ?? [])
        : [];
  const visibleDiagrams =
    spot.kind === 'unsorted'
      ? unsorted
      : spot.kind === 'folder'
        ? (lib.diagramsByFolder.get(spot.id) ?? [])
        : [];

  const crumbs: { label: string; onClick?: () => void }[] = (() => {
    const root = { label: 'Shared diagrams', onClick: () => setSpot({ kind: 'root' }) };
    if (spot.kind === 'root') return [{ label: 'Shared diagrams' }];
    if (spot.kind === 'unsorted') return [root, { label: 'Unsorted' }];
    const chain = lib.breadcrumb(spot.id);
    return [
      root,
      ...chain.slice(0, -1).map((f) => ({
        label: f.name,
        onClick: () => setSpot({ kind: 'folder', id: f.id }),
      })),
      { label: chain[chain.length - 1]?.name ?? 'Folder' },
    ];
  })();

  const folderActions = (f: Folder, anchor: HTMLElement | null) => ({
    rename: () => setRenamingFolderId(f.id),
    newSubfolder: () =>
      void lib.createFolder(f.id).then((created) => {
        if (created) {
          setSpot({ kind: 'folder', id: f.id });
          setRenamingFolderId(created.id);
        }
      }),
    move: () => {
      moveAnchorRef.current = anchor;
      setMoveTarget({ kind: 'folder', id: f.id });
    },
    delete: async () => {
      const ok = await confirm({
        title: 'Delete team folder?',
        message: `"${f.name || 'This folder'}" will be deleted. Its subfolders move to the top level and its diagrams move to the team's Unsorted.`,
        confirmLabel: 'Delete folder',
      });
      if (!ok) return;
      await lib.deleteFolder(f.id);
      if (spot.kind === 'folder' && spot.id === f.id) setSpot({ kind: 'root' });
    },
  });

  // Move-picker rows: every team folder by breadcrumb path, minus the
  // moved folder's own subtree (cycle prevention, mirroring the
  // personal picker).
  const movePickerRows = (() => {
    if (!moveTarget) return [];
    const excluded = new Set<string>();
    if (moveTarget.kind === 'folder') {
      const stack = [moveTarget.id];
      excluded.add(moveTarget.id);
      while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const k of lib.childrenByParent.get(cur) ?? []) {
          if (!excluded.has(k.id)) {
            excluded.add(k.id);
            stack.push(k.id);
          }
        }
      }
    }
    return lib.folders
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({
        id: f.id,
        path: lib
          .breadcrumb(f.id)
          .map((p) => p.name)
          .join(' / '),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  })();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ---------- Breadcrumb + new-folder ---------- */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
        <nav aria-label="Team folders" className="flex min-w-0 flex-wrap items-center text-xs">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="flex items-center">
                {i > 0 ? (
                  <span aria-hidden className="px-1 text-slate-300">
                    ›
                  </span>
                ) : null}
                {c.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded px-1 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {c.label}
                  </button>
                ) : (
                  <span className="px-1 py-0.5 font-semibold uppercase tracking-wider text-slate-500">
                    {c.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() =>
            void lib.createFolder(currentFolderId).then((created) => {
              if (created) setRenamingFolderId(created.id);
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          <PlusIcon />
          {spot.kind === 'folder' ? 'New subfolder' : 'New folder'}
        </button>
      </div>

      {/* ---------- Rows ---------- */}
      {lib.loading ? (
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-4 w-4 animate-pulse rounded bg-slate-200" />
              <span className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
            </li>
          ))}
        </ul>
      ) : visibleFolders.length === 0 &&
        visibleDiagrams.length === 0 &&
        !(spot.kind === 'root' && unsorted.length > 0) ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">
          {spot.kind === 'root'
            ? 'Nothing shared yet. Move a diagram here from your personal explorer ("Move to folder…"), or create a folder to organise ahead.'
            : 'This folder is empty.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {spot.kind === 'root' && unsorted.length > 0 ? (
            <UnsortedRow count={unsorted.length} onOpen={() => setSpot({ kind: 'unsorted' })} />
          ) : null}
          {visibleFolders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              renaming={renamingFolderId === f.id}
              childCount={
                (lib.childrenByParent.get(f.id)?.length ?? 0) +
                (lib.diagramsByFolder.get(f.id)?.length ?? 0)
              }
              onOpen={() => setSpot({ kind: 'folder', id: f.id })}
              onCommitRename={(name) => {
                setRenamingFolderId(null);
                void lib.renameFolder(f.id, name);
              }}
              onCancelRename={() => setRenamingFolderId(null)}
              getActionsForAnchor={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {visibleDiagrams.map((d) => (
            <TeamDiagramRow
              key={d.id}
              diagram={d}
              onMove={(anchor) => {
                moveAnchorRef.current = anchor;
                setMoveTarget({ kind: 'diagram', id: d.id });
              }}
              onRemoveFromTeam={async () => {
                const ok = await confirm({
                  title: 'Remove from team?',
                  message: `"${d.name}" will leave the team's shared diagrams and return to its owner's personal Unsorted.`,
                  confirmLabel: 'Remove',
                });
                if (ok) void lib.removeDiagramFromTeam(d.id);
              }}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {moveTarget ? (
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTarget(null)}
        >
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Unsorted"
            onClick={() => {
              if (moveTarget.kind === 'diagram') void lib.moveDiagram(moveTarget.id, null);
              else void lib.moveFolder(moveTarget.id, null);
              setMoveTarget(null);
            }}
          />
          {movePickerRows.map((row) => (
            <MenuItem
              key={row.id}
              icon={<MenuFolderIcon />}
              label={row.path}
              onClick={() => {
                if (moveTarget.kind === 'diagram') void lib.moveDiagram(moveTarget.id, row.id);
                else void lib.moveFolder(moveTarget.id, row.id);
                setMoveTarget(null);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </div>
  );
}

// One diagram row in the team library. Leaner than the personal
// explorer's DiagramRow on purpose: rename / duplicate / delete stay
// with the owner in their personal surfaces, so the team menu only
// offers what every member may do — open, re-folder, remove from team.
function TeamDiagramRow({
  diagram,
  onMove,
  onRemoveFromTeam,
}: {
  diagram: DiagramSummary;
  onMove: (anchor: HTMLElement | null) => void;
  onRemoveFromTeam: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-slate-400">
          <DiagramIcon />
        </span>
        <Link
          href={`/diagram/${diagram.id}`}
          className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700"
        >
          {diagram.name}
        </Link>
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {formatRelativeTime(Date.now() - diagram.savedAt)}
      </span>
      <button
        ref={menuRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        aria-label={`Menu for ${diagram.name}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
      >
        <EllipsisIcon />
      </button>
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Move to folder…"
            onClick={() => {
              onMove(menuRef.current);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Remove from team"
            danger
            onClick={() => {
              onRemoveFromTeam();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}
