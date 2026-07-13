'use client';

import { useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import type { Folder } from '@livediagram/api-schema';
import { FolderRow, UnsortedRow } from '@/app/explorer/views';
import { CardView } from '@/app/explorer/CardView';
import { ViewToggle } from '@/app/explorer/ViewToggle';
import { useExplorerViewMode } from '@/app/explorer/useExplorerViewMode';
import { MenuFolderIcon, PlusIcon } from '@/app/explorer/icons';
import { DiagramIcon } from '@/app/explorer/icons';
import { TeamDiagramRow } from '@/components/panels/TeamDiagramRow';
import { MenuTile, MenuTileGrid, PortalMenu } from '@/components/primitives/PortalMenu';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useTeamLibrary } from '@/hooks/persistence/useTeamLibrary';
import { useRelativeTimeTick } from '@/lib/relative-time';

// "Shared diagrams" on the team page (spec/35): the team's folder
// tree + diagrams, navigated with a small breadcrumb instead of a
// sidebar. The concept (and most of the row components) is the
// personal explorer's, just team-scoped: every joined member can
// create / rename / move / delete folders, re-folder diagrams, and
// remove a diagram from the team (back to its owner's personal
// Unsorted). The Unsorted bucket is synthetic and undeletable, same
// as the personal tree.

type Spot = { kind: 'root' } | { kind: 'unsorted' } | { kind: 'folder'; id: string };

export function TeamSharedDiagrams({
  ownerId,
  teamId,
  teamName,
}: {
  ownerId: string;
  teamId: string;
  // Shown by the move picker's Team Library card; falls back to "Team".
  teamName?: string;
}) {
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
  // List vs card layout — the same device-local preference (spec/67) the
  // Explorer browse views use, so a card-view user gets cards here too.
  const [viewMode, setViewMode] = useExplorerViewMode();
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

  // Row callbacks, shared by the list rows and the card grid so the two
  // layouts can't drift on what an action does (mirrors the Explorer's
  // diagram-row-shared split).
  const commitRenameFolder = (id: string, name: string) => {
    setRenamingFolderId(null);
    void lib.renameFolder(id, name);
  };
  const startRenameDiagram = (id: string) => setRenamingDiagramId(id);
  const commitRenameDiagram = (id: string, name: string) => {
    setRenamingDiagramId(null);
    void lib.renameDiagram(id, name);
  };
  const duplicateDiagram = (id: string) => void lib.duplicateDiagram(id);
  const deleteDiagram = async (id: string) => {
    const d = lib.diagrams.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete team diagram?',
      message: `"${d?.name || 'This diagram'}" will be permanently deleted for the whole team. This can't be undone.`,
      confirmLabel: 'Delete',
    });
    if (ok) void lib.deleteDiagram(id);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* ---------- Breadcrumb + new-folder ---------- */}
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
                    label={spot.kind === 'folder' ? 'New subfolder' : 'New folder'}
                    onClick={() => {
                      setCreateOpen(false);
                      void lib.createFolder(currentFolderId).then((created) => {
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

      {/* ---------- Rows ---------- */}
      {lib.loading ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </li>
          ))}
        </ul>
      ) : visibleFolders.length === 0 &&
        visibleDiagrams.length === 0 &&
        !(spot.kind === 'root' && unsorted.length > 0) ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          {spot.kind === 'root'
            ? 'Nothing shared yet. Move a diagram here from your personal explorer, or create a folder to organise ahead.'
            : 'This folder is empty.'}
        </p>
      ) : viewMode === 'card' ? (
        // Same folders + diagrams as the list, rendered as the Explorer's
        // card grid (spec/67). Team diagrams (DiagramSummary) satisfy the
        // grid's PaneDiagram contract; the visibility badge is hidden
        // since every card here is a team diagram.
        <div className="p-3">
          <CardView
            folders={visibleFolders}
            diagrams={visibleDiagrams}
            ownerId={ownerId}
            showUnsortedRow={spot.kind === 'root' && unsorted.length > 0}
            unsortedCount={unsorted.length}
            onOpenUnsorted={() => setSpot({ kind: 'unsorted' })}
            onOpenFolder={(id) => setSpot({ kind: 'folder', id })}
            onCommitRenameFolder={commitRenameFolder}
            onCancelRenameFolder={() => setRenamingFolderId(null)}
            renamingFolderId={renamingFolderId}
            renamingDiagramId={renamingDiagramId}
            onCommitRenameDiagram={commitRenameDiagram}
            onCancelRenameDiagram={() => setRenamingDiagramId(null)}
            folderActions={folderActions}
            onStartRenameDiagram={startRenameDiagram}
            onDuplicateDiagram={duplicateDiagram}
            onDeleteDiagram={deleteDiagram}
            onMoveDiagram={(id) => setMoveTarget({ kind: 'diagram', id })}
            childrenCount={(id) => lib.childrenByParent.get(id)?.length ?? 0}
            diagramsCount={(id) => lib.diagramsByFolder.get(id)?.length ?? 0}
            showVisibilityBadge={false}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
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
              onCommitRename={(name) => commitRenameFolder(f.id, name)}
              onCancelRename={() => setRenamingFolderId(null)}
              getActionsForAnchor={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {visibleDiagrams.map((d) => (
            <TeamDiagramRow
              key={d.id}
              diagram={d}
              ownerId={ownerId}
              renaming={renamingDiagramId === d.id}
              onMove={() => setMoveTarget({ kind: 'diagram', id: d.id })}
              onStartRename={() => startRenameDiagram(d.id)}
              onCommitRename={(name) => commitRenameDiagram(d.id, name)}
              onCancelRename={() => setRenamingDiagramId(null)}
              onDuplicate={() => duplicateDiagram(d.id)}
              onDelete={() => deleteDiagram(d.id)}
            />
          ))}
        </ul>
      )}

      {/* ---------- Move picker ---------- */}
      {/* Same shared move modal as the personal surfaces (spec/15),
          scoped to this team's tree: no personal space and a single
          team, so the browser opens straight inside the team library
          (the diagram is already in this team; cross-team moves go via
          the personal picker or Remove-from-team first). */}
      {moveTarget ? (
        <MoveToFolderDialog
          subjectName={
            (moveTarget.kind === 'diagram'
              ? lib.diagrams.find((d) => d.id === moveTarget.id)?.name
              : lib.folders.find((f) => f.id === moveTarget.id)?.name) || 'Untitled'
          }
          subjectKind={moveTarget.kind}
          teams={[{ id: teamId, name: teamName ?? 'Team', folders: movePickerFolders }]}
          currentTeamId={teamId}
          currentFolderId={
            moveTarget.kind === 'diagram'
              ? (lib.diagrams.find((d) => d.id === moveTarget.id)?.folderId ?? null)
              : (lib.folders.find((f) => f.id === moveTarget.id)?.parentId ?? null)
          }
          onCreateFolder={async (name, parentId) => {
            const created = await lib.createFolder(parentId, name);
            return created
              ? { id: created.id, name: created.name, parentId: created.parentId }
              : null;
          }}
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
