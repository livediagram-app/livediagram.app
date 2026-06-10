'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { DiagramSummary, Folder } from '@livediagram/api-schema';
import { FolderRow, UnsortedRow } from '@/app/explorer/views';
import { MenuFolderIcon, MenuTrashIcon, PlusIcon } from '@/app/explorer/icons';
import { DiagramIcon, EllipsisIcon, MenuDuplicateIcon, MenuPencilIcon } from '@/app/explorer/icons';
import { MenuItem, PortalMenu } from './PortalMenu';
import { InlineRenameInput } from './InlineRenameInput';
import { MoveToFolderDialog } from './MoveToFolderDialog';
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
  // Deep link: /explorer/team?id=<team>&folder=<id> opens with that
  // folder focused (the search panel's team-folder results navigate
  // here). Safe to read window in the initialiser: the explorer
  // chrome only mounts post-auth on the client, never in SSG output.
  const [spot, setSpot] = useState<Spot>(() => {
    if (typeof window === 'undefined') return { kind: 'root' };
    const folder = new URLSearchParams(window.location.search).get('folder');
    return folder ? { kind: 'folder', id: folder } : { kind: 'root' };
  });
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingDiagramId, setRenamingDiagramId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<
    { kind: 'diagram'; id: string } | { kind: 'folder'; id: string } | null
  >(null);
  // "+ Create" dropdown (mirrors the personal pane header): one compact
  // button instead of two, so the breadcrumb keeps its room on mobile.
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
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
    const root = { label: 'Team diagrams', onClick: () => setSpot({ kind: 'root' }) };
    if (spot.kind === 'root') return [{ label: 'Team diagrams' }];
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

  // The anchor survives in the row-callback signature (FolderRow's
  // menu passes it) but the move flow is a centred modal now and
  // ignores it.
  const folderActions = (f: Folder, _anchor: HTMLElement | null) => ({
    rename: () => setRenamingFolderId(f.id),
    newSubfolder: () =>
      void lib.createFolder(f.id).then((created) => {
        if (created) {
          setSpot({ kind: 'folder', id: f.id });
          setRenamingFolderId(created.id);
        }
      }),
    move: () => {
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

  // Move-picker folder nodes: every team folder (the picker rebuilds
  // the tree from parentId), minus the moved folder's own subtree
  // (cycle prevention, mirroring the personal picker).
  const movePickerFolders = (() => {
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
      .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }));
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
                  // The section-label uppercase look is reserved for the
                  // root "Shared diagrams" crumb; deeper crumbs are user
                  // folder names and must keep their own casing.
                  <span
                    className={
                      i === 0
                        ? 'px-1 py-0.5 font-semibold uppercase tracking-wider text-slate-500'
                        : 'px-1 py-0.5 font-semibold text-slate-700'
                    }
                  >
                    {c.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        <div className="shrink-0">
          <button
            ref={createRef}
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={createOpen}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-500 px-2 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-brand-600"
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
          </button>
          {createOpen ? (
            <PortalMenu
              anchor={createRef.current}
              placement="below"
              onClose={() => setCreateOpen(false)}
            >
              {/* New diagram lands directly in the team library, scoped
                  to the folder currently open (spec/35): /live/new
                  applies the team + folder placement after the create. */}
              <MenuItem
                icon={<DiagramIcon />}
                label="New diagram"
                onClick={() => {
                  setCreateOpen(false);
                  window.location.assign(
                    `/live/new?team=${encodeURIComponent(teamId)}${
                      currentFolderId ? `&folder=${encodeURIComponent(currentFolderId)}` : ''
                    }`,
                  );
                }}
              />
              <MenuItem
                icon={<MenuFolderIcon />}
                label={spot.kind === 'folder' ? 'New subfolder' : 'New folder'}
                onClick={() => {
                  setCreateOpen(false);
                  void lib.createFolder(currentFolderId).then((created) => {
                    if (created) setRenamingFolderId(created.id);
                  });
                }}
              />
            </PortalMenu>
          ) : null}
        </div>
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
            ? 'Nothing shared yet. Move a diagram here from your personal explorer, or create a folder to organise ahead.'
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
              renaming={renamingDiagramId === d.id}
              onMove={() => {
                setMoveTarget({ kind: 'diagram', id: d.id });
              }}
              onStartRename={() => setRenamingDiagramId(d.id)}
              onCommitRename={(name) => {
                setRenamingDiagramId(null);
                void lib.renameDiagram(d.id, name);
              }}
              onCancelRename={() => setRenamingDiagramId(null)}
              onDuplicate={() => void lib.duplicateDiagram(d.id)}
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Delete team diagram?',
                  message: `"${d.name || 'This diagram'}" will be permanently deleted for the whole team. This can't be undone.`,
                  confirmLabel: 'Delete',
                });
                if (ok) void lib.deleteDiagram(d.id);
              }}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {/* Same shared move modal as the personal surfaces (spec/15),
          scoped to this team's tree: no Teams section (the diagram is
          already in this team; cross-team moves go via the personal
          picker or Remove-from-team first). */}
      {moveTarget ? (
        <MoveToFolderDialog
          subjectName={
            (moveTarget.kind === 'diagram'
              ? lib.diagrams.find((d) => d.id === moveTarget.id)?.name
              : lib.folders.find((f) => f.id === moveTarget.id)?.name) || 'Untitled'
          }
          subjectKind={moveTarget.kind}
          personalRootLabel="Unsorted"
          personalFolders={movePickerFolders}
          currentFolderId={
            moveTarget.kind === 'diagram'
              ? (lib.diagrams.find((d) => d.id === moveTarget.id)?.folderId ?? null)
              : (lib.folders.find((f) => f.id === moveTarget.id)?.parentId ?? null)
          }
          onPick={({ folderId }) => {
            if (moveTarget.kind === 'diagram') void lib.moveDiagram(moveTarget.id, folderId);
            else void lib.moveFolder(moveTarget.id, folderId);
          }}
          onClose={() => setMoveTarget(null)}
        />
      ) : null}
    </div>
  );
}

// One diagram row in the team library. A team diagram is managed by
// every joined member (spec/35), so the menu offers the same actions
// the personal + Recent surfaces do: rename, duplicate, change folder.
function TeamDiagramRow({
  diagram,
  renaming,
  onMove,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  diagram: DiagramSummary;
  renaming: boolean;
  onMove: (anchor: HTMLElement | null) => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50">
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-slate-400">
          <DiagramIcon />
        </span>
        {renaming ? (
          <InlineRenameInput
            initial={diagram.name}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
            className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900"
          />
        ) : (
          <Link
            href={`/diagram/${diagram.id}`}
            className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700"
          >
            {diagram.name}
          </Link>
        )}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {formatRelativeTime(Date.now() - diagram.savedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
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
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Change Folder"
            onClick={() => {
              onMove(menuRef.current);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}
