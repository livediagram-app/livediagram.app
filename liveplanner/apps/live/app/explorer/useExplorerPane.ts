'use client';

import { useMemo } from 'react';
import type { Lens, LensSubject } from '@liveplanner/explorer-lens';
import { leadsBackHome, VIEW_TITLES } from './view-titles';
import type { ProjectListItem, Folder, SharedWithItem } from '@/lib/api-client';
import { groupProjectsByFolder } from '@/lib/folder-tree';
import { isInThisBrowser } from '@/lib/project-space';
import type { TeamProjectRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import { sharedToPaneProject, type PaneProject, type SelectedNode } from './views';
import {
  RECENT_LIMIT,
  isLensSet,
  lensSubjectOf,
  narrowRows,
  scopeProjects,
} from './lens/pane-lens';

/** What the lens did to the current view (docs/specs/013-workspace/explorer-filters.md "States"). */
type PaneLensResult = {
  /** The lens narrows something: a word or a value is set. */
  active: boolean;
  /** Projects shown, and projects the lens ran over, for the live region. */
  shown: number;
  total: number;
  /** Nothing in the view at all, folders included: the view's own empty state. */
  empty: boolean;
  /** The rows the lens reads, for marking a suggestion that matches nothing. */
  subjects: readonly LensSubject[];
};

const newestFirst = <D extends { savedAt: number }>(rows: D[]): D[] =>
  rows.sort((a, b) => b.savedAt - a.savedAt);

// The right-pane derivations (docs/specs/013-workspace/folders.md), lifted out of useExplorerState:
// the per-folder project buckets, the pane content narrowed by the lens, its title and breadcrumb,
// and the sidebar's Recent badge count. Pure memos over the state the orchestration hook owns.
export function useExplorerPane({
  selected,
  projects: liveDocs,
  teamProjects,
  shared,
  childrenByParent,
  folderById,
  teams,
  breadcrumb,
  go,
  recentExcludedIds,
  favouriteIds,
  lens,
  viewerId,
  now,
}: {
  selected: SelectedNode;
  projects: ProjectListItem[];
  teamProjects: TeamProjectRow[];
  shared: SharedWithItem[];
  childrenByParent: Map<string | null, Folder[]>;
  folderById: Map<string, Folder>;
  teams: { id: string; name: string }[];
  breadcrumb: (folderId: string | null) => Folder[];
  go: (sel: SelectedNode) => void;
  // Projects this user hid from Recent (docs/specs/013-workspace/hide-from-recent.md). Only Recent honours it.
  recentExcludedIds: string[];
  // Projects this user starred (docs/specs/013-workspace/favourites.md), personal and team.
  favouriteIds: Set<string>;
  // The current lens (docs/specs/013-workspace/explorer-filters.md) and the clock Edited reads.
  lens: Lens;
  viewerId: string;
  now: number;
}) {
  // A project saved only in this browser lives in This Browser, not at the root of My Projects
  // (docs/specs/013-workspace/explorer-structure.md); filed in one of the reader's folders, it is
  // listed there.
  const projectsByFolder = useMemo(
    () =>
      groupProjectsByFolder(liveDocs, {
        exclude: (d) => d.folderId === null && isInThisBrowser(d),
      }),
    [liveDocs],
  );

  // Every project saved only in this browser, wherever its local record files it.
  const offlineProjects = useMemo(
    () => newestFirst(liveDocs.filter((d) => isInThisBrowser(d))),
    [liveDocs],
  );

  const excluded = useMemo(() => new Set(recentExcludedIds), [recentExcludedIds]);

  // Everything the reader can open, newest first: Search results' list, and the rows a view with
  // no lens of its own suggests against (typing there opens Search results).
  const everything = useMemo<PaneProject[]>(
    () => newestFirst([...liveDocs, ...teamProjects, ...shared.map(sharedToPaneProject)]),
    [liveDocs, teamProjects, shared],
  );

  const lensSet = isLensSet(lens);

  // What the view lists before the lens: its folders, the projects the lens runs over, the rows
  // a set lens would reach (a scoped view's whole subtree), and whether the view holds anything at
  // all. A set lens on a scoped view reaches every subfolder and steps the folder rows aside.
  const base = useMemo<{
    folders: Folder[];
    projects: PaneProject[];
    reach: PaneProject[];
    bare: boolean;
  }>(() => {
    const listing = (projects: PaneProject[]) => ({
      folders: [],
      projects,
      reach: projects,
      bare: projects.length === 0,
    });
    switch (selected.kind) {
      case 'recent':
        return listing(everything.filter((d) => !excluded.has(d.id)));
      case 'search':
        return listing(everything);
      case 'shared':
        return listing(everything.filter((d) => d.shared));
      case 'favourites':
        return listing(
          newestFirst([...liveDocs, ...teamProjects].filter((d) => favouriteIds.has(d.id))),
        );
      case 'offline':
        return listing(offlineProjects);
      case 'all':
      case 'folder': {
        const folderId = selected.kind === 'folder' ? selected.id : null;
        const folders = childrenByParent.get(folderId) ?? [];
        const direct = projectsByFolder.get(folderId) ?? [];
        const reach = scopeProjects(folderId, childrenByParent, projectsByFolder);
        const bare = folders.length === 0 && direct.length === 0;
        return lensSet
          ? { folders: [], projects: reach, reach, bare }
          : { folders, projects: direct, reach, bare };
      }
      case 'team':
        // The team page reads and narrows its own library; the sweep's copy feeds the suggestions.
        return { ...listing([]), reach: teamProjects.filter((d) => d.team.id === selected.id) };
      default:
        // No lens here: typing opens Search results, so its rows are the ones suggested against.
        return { ...listing([]), reach: everything };
    }
  }, [
    selected,
    everything,
    excluded,
    liveDocs,
    teamProjects,
    favouriteIds,
    offlineProjects,
    childrenByParent,
    projectsByFolder,
    lensSet,
  ]);

  const paneContent = useMemo<{ folders: Folder[]; projects: PaneProject[] }>(() => {
    const matched = narrowRows(base.projects, lens, viewerId, now);
    const projects = selected.kind === 'recent' ? matched.slice(0, RECENT_LIMIT) : matched;
    return { folders: base.folders, projects };
  }, [base, lens, viewerId, now, selected.kind]);

  const lensResult = useMemo<PaneLensResult>(() => {
    const total =
      selected.kind === 'recent'
        ? Math.min(RECENT_LIMIT, base.projects.length)
        : base.projects.length;
    return {
      active: lensSet,
      shown: paneContent.projects.length,
      total,
      empty: base.bare,
      subjects: base.reach.map((d) => lensSubjectOf(d, viewerId)),
    };
  }, [base, paneContent.projects.length, lensSet, selected.kind, viewerId]);

  // The sidebar's Recent count, mirroring "Shared With Me": how many rows Recent shows, capped.
  const recentCount = useMemo(() => {
    const visible =
      liveDocs.filter((d) => !excluded.has(d.id)).length +
      teamProjects.filter((d) => !excluded.has(d.id)).length +
      shared.filter((s) => !excluded.has(s.id)).length;
    return Math.min(RECENT_LIMIT, visible);
  }, [liveDocs, teamProjects, shared, excluded]);

  // Each view is named by its sidebar row (VIEW_TITLES); a folder or team by its own name.
  const paneTitle = useMemo(() => {
    if (selected.kind === 'team') return teams.find((t) => t.id === selected.id)?.name ?? 'Team';
    if (selected.kind === 'folder') return folderById.get(selected.id)?.name ?? 'Folder';
    return VIEW_TITLES[selected.kind];
  }, [selected, folderById, teams]);

  // Breadcrumb segments for the pane header, following the sidebar's rows. The leaf (the current
  // view) is plain text. Folders sit under My Projects, Recent under Home; every
  // other view is its own single leaf.
  type Crumb = { name: string; onClick?: () => void };
  const paneCrumbs = useMemo<Crumb[]>(() => {
    // Recent is reached from Home, and leads back to it.
    if (leadsBackHome(selected.kind))
      return [{ name: VIEW_TITLES.home, onClick: () => go({ kind: 'home' }) }, { name: paneTitle }];
    if (selected.kind !== 'folder') return [{ name: paneTitle }];
    const chain = breadcrumb(selected.id);
    return [
      { name: VIEW_TITLES.all, onClick: () => go({ kind: 'all' }) },
      ...chain.slice(0, -1).map((c) => ({
        name: c.name,
        onClick: () => go({ kind: 'folder', id: c.id }),
      })),
      { name: chain[chain.length - 1]?.name ?? 'Folder' },
    ];
  }, [selected, paneTitle, breadcrumb, go]);

  return {
    projectsByFolder,
    offlineProjects,
    paneContent,
    lensResult,
    recentCount,
    paneTitle,
    paneCrumbs,
  };
}
