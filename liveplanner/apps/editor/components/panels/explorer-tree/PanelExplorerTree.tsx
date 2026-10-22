'use client';

import { useMemo } from 'react';
import { useDefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';
import type { ProjectListItem, SharedWithItem } from '@/lib/api-client';
import { sharedToPaneProject, type PaneProject, type SelectedNode } from '@/app/explorer/views';
import { EmptyPane } from '@/app/explorer/ExplorerEmptyState';
import { BackBar } from '@/components/primitives/BackBar';
import { groupProjectsByFolder, indexFolders } from '@/lib/folder-tree';
import type { PanelSection } from '../explorer-panel/panel-sections';
import { PaneGrid, PaneList, PaneSkeleton } from '../explorer-panel/pane-parts';
import { PanelFolderItem, type PanelFolder, type PanelFolderIndex } from './PanelFolderItem';
import { PanelProjectItem } from './PanelProjectItem';
import { PanelTagsSection } from './PanelTagsSection';
import { PanelTreeProvider, type PanelTree } from './PanelTreeContext';

export type PanelTreeSection = Extract<
  PanelSection,
  { kind: 'mine' } | { kind: 'team' } | { kind: 'browser' } | { kind: 'shared' } | { kind: 'tags' }
>;

export const isTreeSection = (s: PanelSection): s is PanelTreeSection =>
  s.kind === 'mine' ||
  s.kind === 'team' ||
  s.kind === 'browser' ||
  s.kind === 'shared' ||
  s.kind === 'tags';

const NO_FOLDERS: PanelFolder[] = [];

// The folder the pane shows, and so where its New Folder lands: the open one while it is still among the space's
// folders, else the space's root (a folder deleted or moved away while open).
export function paneFolderParent(
  folders: Iterable<{ id: string }>,
  folderId: string | null,
): string | null {
  if (!folderId) return null;
  for (const f of folders) if (f.id === folderId) return folderId;
  return null;
}
const NO_PROJECTS: ProjectListItem[] = [];

// The rows of one of the editor's Explorer sections that hold projects (docs/specs/013-workspace/explorer-structure.md
// "The pane"): My Work' and a team's folders then projects, opening a folder in place under a breadcrumb back
// to the space's root; This Browser's projects; what is shared with the reader. Each empty place says so in the
// Explorer's own empty state.
export function PanelExplorerTree({
  section,
  rootLabel,
  tree,
  busy = false,
  shared,
  ownIndex,
  offlineProjects,
  teams,
  foldersByTeam,
  projectsByTeam,
  folderId,
  onOpenFolder,
}: {
  section: PanelTreeSection;
  // The space's name, the breadcrumb's first step.
  rootLabel: string;
  tree: PanelTree;
  // The project lists are still loading.
  busy?: boolean;
  shared: SharedWithItem[];
  // The reader's own tree, this browser's projects excluded.
  ownIndex: PanelFolderIndex;
  offlineProjects: ProjectListItem[];
  teams: { id: string; name: string }[];
  foldersByTeam: Map<string, PanelFolder[]>;
  projectsByTeam: Map<string, ProjectListItem[]>;
  // The folder open in the pane, null at the space's root. The host holds it, so its header's New Folder makes the
  // folder in the one open here (paneFolderParent).
  folderId: string | null;
  onOpenFolder: (id: string | null) => void;
}) {
  // The reader's default folders (docs/specs/013-workspace/default-folders.md): the folder menus check and set them.
  const defaultFolders = useDefaultFolderMenus(
    tree.ownerId,
    useMemo(
      () => ({
        personal: [...ownIndex.foldersByParent.values()].flat(),
        team: Object.fromEntries(foldersByTeam),
        teams,
      }),
      [ownIndex, foldersByTeam, teams],
    ),
  );
  const team = section.kind === 'team' ? teams.find((t) => t.id === section.id) : undefined;
  const teamFolders = (team && foldersByTeam.get(team.id)) || NO_FOLDERS;
  const teamProjects = (team && projectsByTeam.get(team.id)) || NO_PROJECTS;
  const teamIndex = useMemo<PanelFolderIndex>(
    () => ({
      foldersByParent: indexFolders(teamFolders).childrenByParent,
      projectsByFolder: groupProjectsByFolder(teamProjects),
    }),
    [teamFolders, teamProjects],
  );
  const draggable = !!tree.onMoveProjectToFolder;

  const value = { ...tree, defaultFolders, onOpenFolder };
  let body: React.ReactNode;
  if (section.kind === 'tags') {
    // Every project a tag can sit on: the reader's own (this browser's included) and their teams', newest first.
    const own = [...ownIndex.projectsByFolder.values()].flat();
    const byTeam = teams.flatMap((t) =>
      (projectsByTeam.get(t.id) ?? NO_PROJECTS).map((d): PaneProject => ({ ...d, team: t })),
    );
    // By id: a browser project filed in a folder is in both of the first two lists.
    const docs = [
      ...new Map([...own, ...offlineProjects, ...byTeam].map((d) => [d.id, d])).values(),
    ].sort((a, b) => b.savedAt - a.savedAt);
    body = <PanelTagsSection projects={docs} />;
  } else if (section.kind === 'browser' || section.kind === 'shared') {
    const docs: PaneProject[] =
      section.kind === 'browser' ? offlineProjects : shared.map(sharedToPaneProject);
    body = docs.length ? (
      <PaneList label={rootLabel}>
        {docs.map((d) => (
          <PanelProjectItem key={d.id} project={d} />
        ))}
      </PaneList>
    ) : (
      <EmptyPane compact selected={{ kind: section.kind === 'browser' ? 'offline' : 'shared' }} />
    );
  } else {
    const index = section.kind === 'team' ? teamIndex : ownIndex;
    const byId = new Map([...index.foldersByParent.values()].flat().map((f) => [f.id, f]));
    // A folder deleted (or moved away) while open: back to the root.
    const here = paneFolderParent(byId.values(), folderId);
    const trail: PanelFolder[] = [];
    for (
      let f = here ? byId.get(here) : undefined;
      f;
      f = f.parentId ? byId.get(f.parentId) : undefined
    )
      trail.unshift(f);
    const folders = index.foldersByParent.get(here) ?? [];
    const docs = index.projectsByFolder.get(here) ?? [];
    const empty: SelectedNode = here ? { kind: 'folder', id: here } : { kind: 'all' };
    body = (
      <div className="flex flex-col gap-1">
        {/* The import and export screens' back bar: back to the folder above (or the space's root), the folder open
            here as its chip. */}
        {trail.length ? (
          <BackBar
            gap="tight"
            label={trail.at(-2)?.name ?? rootLabel}
            current={trail.at(-1)!.name}
            onClick={() => onOpenFolder(trail.at(-2)?.id ?? null)}
          />
        ) : null}
        {folders.length + docs.length ? (
          // Keyed by the folder open, so opening one slides its contents in.
          <div key={here ?? 'root'} className="flex animate-view-forward flex-col gap-3">
            {folders.length ? (
              <PaneGrid label={`Folders in ${trail.at(-1)?.name ?? rootLabel}`}>
                {folders.map((f) => (
                  <PanelFolderItem key={f.id} folder={f} index={index} team={team} />
                ))}
              </PaneGrid>
            ) : null}
            {docs.length ? (
              <PaneList label={trail.at(-1)?.name ?? rootLabel}>
                {docs.map((d) => (
                  <PanelProjectItem
                    key={d.id}
                    project={team ? { ...d, team } : d}
                    draggable={!team && draggable}
                  />
                ))}
              </PaneList>
            ) : null}
          </div>
        ) : (
          <EmptyPane compact cta={false} selected={empty} />
        )}
      </div>
    );
  }
  return (
    <PanelTreeProvider value={value}>
      {busy && section.kind !== 'shared' ? <PaneSkeleton /> : body}
    </PanelTreeProvider>
  );
}
