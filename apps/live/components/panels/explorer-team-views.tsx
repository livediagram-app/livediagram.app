'use client';

// The panel's Teams accordion views, split out of explorer-views.tsx: a team
// expands to its folder tree and the diagrams inside each folder. A distinct
// concern from the personal folder / diagram / shared rows, which stay in
// explorer-views.tsx. Renders the shared DiagramRow (imported from there) for
// each team diagram. Same stateless-renderer pattern as its sibling.

import { useMemo } from 'react';
// Row data shapes come straight from the api client (the same rows
// apiListDiagrams / useFolders / apiListSharedWith return) so the
// panel and the /explorer route can't drift apart on what a list
// item carries.
import type { DiagramListItem } from '@/lib/api-client';

import { ChevronIcon, FolderIcon } from '@/components/panels/explorer-icons';
import { DiagramRow } from '@/components/panels/explorer-views';

// Mirror of FolderNode for the panel's Teams accordion: a team expands
// to its folder tree AND the diagrams inside each folder, which open
// in place (any joined member may open them). Folder management
// (rename / move / delete / new) stays on the team page, so a click on
// a folder NAME opens that page there; the nodes carry no menus or drop
// targets. Folder ids are globally unique, so they share the panel's
// one `expanded` record with the personal folder tree.

type TeamFolderTreeNode = { id: string; name: string; parentId: string | null };

function TeamFolderNode({
  folder,
  depth,
  childrenByParent,
  diagramsByFolder,
  currentDiagramId,
  expanded,
  onToggleExpanded,
  onOpenDiagram,
  deleteFor,
}: {
  folder: TeamFolderTreeNode;
  depth: number;
  childrenByParent: Map<string | null, TeamFolderTreeNode[]>;
  diagramsByFolder: Map<string | null, DiagramListItem[]>;
  currentDiagramId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  onOpenDiagram: (id: string) => void;
  // Owner-gated per-row delete, threaded down from TeamNode so nested
  // folder rows share the same ownership check (spec/35).
  deleteFor: (d: DiagramListItem) => ((anchor: HTMLElement | null) => void) | undefined;
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const diagramsHere = diagramsByFolder.get(folder.id) ?? [];
  const hasContent = kids.length > 0 || diagramsHere.length > 0;
  const isExpanded = expanded[folder.id] ?? false;
  return (
    <li>
      <div
        className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          disabled={!hasContent}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-0 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {hasContent ? (
            <span
              className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              aria-hidden
            >
              <ChevronIcon />
            </span>
          ) : null}
        </button>
        <span className="text-slate-400 dark:text-slate-400">
          <FolderIcon />
        </span>
        <button
          type="button"
          onClick={() => onToggleExpanded(folder.id)}
          className="min-w-0 flex-1 truncate text-left"
        >
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded && hasContent ? (
        <ul className="flex flex-col gap-0.5">
          {kids.map((k) => (
            <TeamFolderNode
              key={k.id}
              folder={k}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              diagramsByFolder={diagramsByFolder}
              currentDiagramId={currentDiagramId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onOpenDiagram={onOpenDiagram}
              deleteFor={deleteFor}
            />
          ))}
          {diagramsHere.map((d) => (
            <li key={d.id} style={{ paddingLeft: 4 + (depth + 1) * 12 }}>
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={deleteFor(d)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TeamNode({
  team,
  folders,
  diagrams,
  currentDiagramId,
  expanded,
  onToggleExpanded,
  onOpenTeam,
  onOpenDiagram,
  onDeleteDiagram,
}: {
  team: { id: string; name: string };
  // This team's folder rows (flat, with parentId).
  folders: TeamFolderTreeNode[];
  // This team's diagrams (carry folderId; null = the team's Unsorted).
  diagrams: DiagramListItem[];
  currentDiagramId: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  // The team NAME opens the full team page; folders + diagrams browse
  // inline in the panel (spec/35).
  onOpenTeam: (teamId: string) => void;
  onOpenDiagram: (id: string) => void;
  // Hard delete on a team-library row, available to any joined member
  // (spec/35). Anchored to the row's menu button so Explorer can pop
  // its ConfirmPopover beside it.
  onDeleteDiagram?: (id: string, anchor: HTMLElement | null) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TeamFolderTreeNode[]>();
    for (const f of folders) {
      const bucket = map.get(f.parentId) ?? [];
      bucket.push(f);
      map.set(f.parentId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);
  const diagramsByFolder = useMemo(() => {
    const map = new Map<string | null, DiagramListItem[]>();
    for (const d of diagrams) {
      const bucket = map.get(d.folderId) ?? [];
      bucket.push(d);
      map.set(d.folderId, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => b.savedAt - a.savedAt);
    return map;
  }, [diagrams]);
  const rootFolders = childrenByParent.get(null) ?? [];
  // Diagrams loose at the team root (its synthetic Unsorted bucket).
  const rootDiagrams = diagramsByFolder.get(null) ?? [];
  // Delete is available to every joined member (spec/35): a team
  // diagram is managed by the whole team, not just its owner. Any
  // diagram shown in this team section means the viewer is a joined
  // member, so the only gate is that a delete handler was wired.
  // Shared by the root rows here and the nested TeamFolderNode rows.
  const deleteFor = (d: DiagramListItem) =>
    onDeleteDiagram ? (anchor: HTMLElement | null) => onDeleteDiagram(d.id, anchor) : undefined;
  const hasContent = rootFolders.length > 0 || rootDiagrams.length > 0;
  const isExpanded = expanded[team.id] ?? false;
  return (
    <li>
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
        <button
          type="button"
          onClick={() => onToggleExpanded(team.id)}
          aria-label={isExpanded ? 'Collapse team' : 'Expand team'}
          disabled={!hasContent}
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-0 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {hasContent ? (
            <span
              className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              aria-hidden
            >
              <ChevronIcon />
            </span>
          ) : null}
        </button>
        <span className="text-slate-400 dark:text-slate-400" aria-hidden>
          <TeamGlyph />
        </span>
        <button
          type="button"
          // Clicking the team name expands it inline (like a folder),
          // rather than navigating to the team page. An empty team has
          // nothing to expand, so it falls back to opening the page (so
          // you can still reach it to add a first diagram).
          onClick={() => (hasContent ? onToggleExpanded(team.id) : onOpenTeam(team.id))}
          aria-expanded={hasContent ? isExpanded : undefined}
          className="min-w-0 flex-1 truncate text-left"
        >
          <span className="truncate">{team.name}</span>
        </button>
      </div>
      {isExpanded && hasContent ? (
        <ul className="flex flex-col gap-0.5">
          {rootFolders.map((f) => (
            <TeamFolderNode
              key={f.id}
              folder={f}
              depth={1}
              childrenByParent={childrenByParent}
              diagramsByFolder={diagramsByFolder}
              currentDiagramId={currentDiagramId}
              expanded={expanded}
              onToggleExpanded={onToggleExpanded}
              onOpenDiagram={onOpenDiagram}
              deleteFor={deleteFor}
            />
          ))}
          {rootDiagrams.map((d) => (
            <li key={d.id} style={{ paddingLeft: 4 + 1 * 12 }}>
              <DiagramRow
                item={d}
                active={d.id === currentDiagramId}
                onOpen={() => onOpenDiagram(d.id)}
                onDelete={deleteFor(d)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TeamGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
      <circle cx="11.5" cy="6.5" r="1.8" />
      <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
    </svg>
  );
}
