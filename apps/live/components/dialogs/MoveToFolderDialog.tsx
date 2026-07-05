'use client';

// Move-destination picker, styled like the LinkPickerDialog (centred
// modal, brand chrome, scrollable row list). Replaces the tiny
// anchored PortalMenu the move flow used to squeeze its destinations
// into.
//
// Destinations render as ONE indented, collapsible tree (spec/35):
// "All diagrams" (the personal root) with the personal folder tree
// nested beneath, then each team's root with its folder tree nested
// beneath. No "A / B" breadcrumb strings and no repeated team-name
// prefixes: a folder's place is shown by its indentation, the same
// way the Explorer sidebar shows it.
//
// Shared by the /explorer page (diagram + folder moves, team
// destinations) and the editor's floating Explorer panel (personal
// diagram moves only — it passes no teams). Portal-rendered so
// `position: fixed` escapes transformed ancestors like the floating
// panel.
//
// Generic by design: the caller supplies the folder nodes (already
// cycle-filtered for a folder move) and receives the pick — a
// `{ teamId, folderId }` destination — via `onPick`; this component
// only renders, filters, and collapses.

import { Fragment, useState } from 'react';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { DestinationRow, FolderIcon, RootIcon, TeamIcon } from './move-to-folder-parts';
import { useEscape } from '@/hooks/ui/useEscape';
import { matches } from '@/lib/search';

// One folder in a tree. The caller passes a flat list; this component
// rebuilds the hierarchy from `parentId`.
export type MoveFolderNode = { id: string; name: string; parentId: string | null };

// A team library destination: its root (= the team's Unsorted) plus
// its folder tree.
type MoveTeamDest = { id: string; name: string; folders: MoveFolderNode[] };

// Where the subject should move to. `teamId` null = the caller's
// personal library; `folderId` null = that scope's root / Unsorted.
export type MoveDestination = { teamId: string | null; folderId: string | null };

type MoveToFolderDialogProps = {
  // What's being moved, for the header ("Move "Roadmap 2026"").
  subjectName: string;
  // Tweaks the copy: a folder move re-parents, a diagram move files.
  subjectKind: 'diagram' | 'folder';
  // Label for the personal root: "All diagrams" on the explorer page,
  // "Unsorted" in the floating panel (same bucket, the name each
  // surface already uses for it).
  personalRootLabel: string;
  // Personal folder nodes, pre-filtered by the caller (a folder move
  // excludes its own subtree).
  personalFolders: MoveFolderNode[];
  // Team libraries (spec/35). Only diagram moves on the explorer page
  // pass these; omitted / [] = no Teams sections.
  teams?: MoveTeamDest[];
  // The subject's current placement; that row gets a "current" chip
  // and is disabled (moving there is a no-op). teamId null +
  // folderId null = the personal root.
  currentTeamId?: string | null;
  currentFolderId?: string | null;
  onPick: (dest: MoveDestination) => void;
  onClose: () => void;
};

export function MoveToFolderDialog({
  subjectName,
  subjectKind,
  personalRootLabel,
  personalFolders,
  teams,
  currentTeamId = null,
  currentFolderId = null,
  onPick,
  onClose,
}: MoveToFolderDialogProps) {
  // Filter box: with a real folder tree the list gets long; same
  // case-insensitive substring matcher the search panel uses.
  const [query, setQuery] = useState('');
  // Collapsed group/folder keys. Default empty = everything expanded,
  // so the whole tree is visible for picking; the chevrons let the
  // user fold a branch away.
  // Expanded group/folder keys. The personal ("My Work") group starts
  // open — it's the common destination — while teams and nested
  // folders start collapsed, so the modal opens compact and the user
  // drills in as needed. A live filter force-opens everything so
  // matches always surface.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['personal']));
  // Capture-phase Esc so this wins over the editor's global shortcuts; the
  // Dialog shell's own (bubble-phase) Esc is suppressed via closeOnEscape.
  useEscape(onClose, { capture: true, stopPropagation: true });

  const filtering = query.trim().length > 0;
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const pick = (dest: MoveDestination) => {
    onPick(dest);
    onClose();
  };

  // Folders whose name matches, plus every ancestor (so the path to a
  // match stays visible). null = no filter, show all.
  const visibleFolders = (folders: MoveFolderNode[]): Set<string> | null => {
    if (!filtering) return null;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const visible = new Set<string>();
    for (const f of folders) {
      if (!matches(query, f.name)) continue;
      let cur: MoveFolderNode | undefined = f;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        visible.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    return visible;
  };

  // Recursive folder rows for one scope (personal or a team).
  const renderBranch = (
    folders: MoveFolderNode[],
    visible: Set<string> | null,
    teamId: string | null,
    parentId: string | null,
    depth: number,
  ): React.ReactNode[] => {
    const kids = folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const rows: React.ReactNode[] = [];
    for (const f of kids) {
      if (visible && !visible.has(f.id)) continue;
      const hasKids = folders.some((c) => c.parentId === f.id);
      const open = filtering || expanded.has(f.id);
      const isCurrent = currentTeamId === teamId && currentFolderId === f.id;
      rows.push(
        <Fragment key={`${teamId ?? 'personal'}:${f.id}`}>
          <DestinationRow
            depth={depth}
            icon={<FolderIcon />}
            label={f.name}
            isCurrent={isCurrent}
            hasChildren={hasKids}
            open={open}
            onToggle={() => toggle(f.id)}
            onClick={() => pick({ teamId, folderId: f.id })}
          />
          {open && hasKids ? renderBranch(folders, visible, teamId, f.id, depth + 1) : null}
        </Fragment>,
      );
    }
    return rows;
  };

  // ---- Personal group ----
  const personalVisible = visibleFolders(personalFolders);
  const personalRootMatches = !filtering || matches(query, personalRootLabel);
  const personalHasVisibleFolder = personalVisible ? personalVisible.size > 0 : true;
  const personalGroupVisible = personalRootMatches || personalHasVisibleFolder;
  const personalOpen = filtering || expanded.has('personal');

  // ---- Team groups ----
  const teamGroups = (teams ?? []).map((t) => {
    const visible = visibleFolders(t.folders);
    const rootMatches = !filtering || matches(query, t.name);
    const hasVisibleFolder = visible ? visible.size > 0 : t.folders.length > 0;
    return { team: t, visible, groupVisible: rootMatches || hasVisibleFolder };
  });

  const empty = !personalGroupVisible && teamGroups.every((g) => !g.groupVisible);

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Move to folder"
      size="md"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            Move &ldquo;{subjectName}&rdquo;
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {subjectKind === 'folder'
              ? 'Pick the folder it should live inside.'
              : 'Pick a destination folder or team.'}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>

      <div className="border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter destinations…"
          aria-label="Filter destinations"
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {empty ? (
          <p className="px-1 py-8 text-center text-xs text-slate-400 dark:text-slate-400">
            No destination matches.
          </p>
        ) : (
          <>
            {personalGroupVisible ? (
              <>
                <DestinationRow
                  depth={0}
                  icon={<RootIcon />}
                  label={personalRootLabel}
                  isCurrent={currentTeamId === null && currentFolderId === null}
                  hasChildren={personalFolders.length > 0}
                  open={personalOpen}
                  onToggle={() => toggle('personal')}
                  onClick={() => pick({ teamId: null, folderId: null })}
                />
                {personalOpen
                  ? renderBranch(personalFolders, personalVisible, null, null, 1)
                  : null}
              </>
            ) : null}

            {teamGroups.map(({ team, visible, groupVisible }) => {
              if (!groupVisible) return null;
              const open = filtering || expanded.has(team.id);
              return (
                <Fragment key={team.id}>
                  <DestinationRow
                    depth={0}
                    icon={<TeamIcon />}
                    label={team.name}
                    isCurrent={currentTeamId === team.id && currentFolderId === null}
                    hasChildren={team.folders.length > 0}
                    open={open}
                    onToggle={() => toggle(team.id)}
                    onClick={() => pick({ teamId: team.id, folderId: null })}
                  />
                  {open ? renderBranch(team.folders, visible, team.id, null, 1) : null}
                </Fragment>
              );
            })}
          </>
        )}
      </div>
    </Dialog>
  );
}
