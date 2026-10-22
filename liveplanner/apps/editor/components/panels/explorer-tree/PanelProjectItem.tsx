'use client';

import { ThisBrowserPill, THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { MadeByAiPill, isMadeByAi } from '@/components/primitives/MadeByAiPill';
import { FavouriteMarker } from '@/app/explorer/project-badges';
import { useProjectTags } from '@/components/tags/ProjectTagsProvider';
import { ProjectTagDots } from '@/components/tags/TagChip';
import { ProjectThumbnail } from '@/components/panels/ProjectThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { PaneRow, PANE_THUMB_BOX } from '../explorer-panel/pane-parts';
import type { PaneProject } from '@/app/explorer/views';
import { isInThisBrowser } from '@/lib/project-space';
import { startProjectDrag } from '../explorer-drag-mime';
import { usePanelTree } from './PanelTreeContext';
import { usePaneProjectMenu } from './usePaneProjectMenu';

// A project row of the editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): its
// thumbnail, name and last save; activating it opens the project; it carries the one project menu (⋯,
// right-click, Shift+F10), its star and, saved only in this browser, the This Browser pill. The open project's row
// is the current one.
export function PanelProjectItem({
  project: doc,
  draggable = false,
}: {
  // `team` set: a team-library project, whose Change Folder opens the picker on that team.
  // `shared` set: a project shared with the reader, opened on its share link, with Dismiss.
  project: PaneProject;
  draggable?: boolean;
}) {
  const tree = usePanelTree();
  const menu = usePaneProjectMenu(doc);
  const name = doc.name || 'Untitled project';
  const local = isInThisBrowser(doc);
  const shareCode = doc.shared?.shareCode;
  const favourite = tree.favouriteIds?.has(doc.id) === true;
  // The reader's tags as dots (docs/specs/013-workspace/tags.md "Where tags show"): the row is too narrow for chips.
  const tags = useProjectTags().tagsFor(doc.id);
  const open = () => tree.onOpenProject(doc.id, shareCode);
  const now = useRelativeNow();
  const current = doc.id === tree.currentProjectId;
  return (
    <PaneRow
      leading={
        <ProjectThumbnail
          ownerId={tree.ownerId}
          projectId={doc.id}
          version={doc.savedAt}
          empty={doc.empty}
          shareCode={shareCode ?? null}
          offline={doc.ownerId === OFFLINE_OWNER_ID}
          className={PANE_THUMB_BOX}
        />
      }
      title={
        <span className="flex min-w-0 items-center gap-1">
          {favourite ? <FavouriteMarker /> : null}
          <span className="min-w-0 truncate">{name}</span>
          <ProjectTagDots tags={tags} />
        </span>
      }
      label={local ? `${name}. ${THIS_BROWSER_DESCRIPTION}` : name}
      meta={`Updated ${relativeSince(doc.savedAt, now)}`}
      current={current}
      onActivate={open}
      className={tree.exitingProjectIds.has(doc.id) ? 'animate-slide-row-out overflow-hidden' : ''}
      rowProps={{
        onContextMenu: menu.onContextMenu,
        ...(draggable
          ? {
              draggable: true,
              onDragStart: (e: React.DragEvent) =>
                startProjectDrag(e.dataTransfer, { id: doc.id, localOnly: local }),
            }
          : {}),
      }}
      trailing={
        <>
          {local ? <ThisBrowserPill tabbable={false} /> : null}
          {isMadeByAi(doc) ? <MadeByAiPill compact /> : null}
          {menu.trailing}
        </>
      }
    />
  );
}
