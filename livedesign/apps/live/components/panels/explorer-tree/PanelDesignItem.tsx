'use client';

import { ThisBrowserPill, THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { MadeByAiPill, isMadeByAi } from '@/components/primitives/MadeByAiPill';
import { FavouriteMarker } from '@/app/explorer/design-badges';
import { useDesignTags } from '@/components/tags/DesignTagsProvider';
import { DesignTagDots } from '@/components/tags/TagChip';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { PaneRow, PANE_THUMB_BOX } from '../explorer-panel/pane-parts';
import type { PaneDesign } from '@/app/explorer/views';
import { isInThisBrowser } from '@/lib/design-space';
import { startDesignDrag } from '../explorer-drag-mime';
import { usePanelTree } from './PanelTreeContext';
import { usePaneDesignMenu } from './usePaneDesignMenu';

// A design row of the editor's Explorer pane (docs/specs/013-workspace/explorer-structure.md "The pane"): its
// thumbnail, name and last save; activating it opens the design; it carries the one design menu (⋯,
// right-click, Shift+F10), its star and, saved only in this browser, the This Browser pill. The open design's row
// is the current one.
export function PanelDesignItem({
  design: doc,
  draggable = false,
}: {
  // `team` set: a team-library design, whose Change Folder opens the picker on that team.
  // `shared` set: a design shared with the reader, opened on its share link, with Dismiss.
  design: PaneDesign;
  draggable?: boolean;
}) {
  const tree = usePanelTree();
  const menu = usePaneDesignMenu(doc);
  const name = doc.name || 'Untitled design';
  const local = isInThisBrowser(doc);
  const shareCode = doc.shared?.shareCode;
  const favourite = tree.favouriteIds?.has(doc.id) === true;
  // The reader's tags as dots (docs/specs/013-workspace/tags.md "Where tags show"): the row is too narrow for chips.
  const tags = useDesignTags().tagsFor(doc.id);
  const open = () => tree.onOpenDesign(doc.id, shareCode);
  const now = useRelativeNow();
  const current = doc.id === tree.currentDesignId;
  return (
    <PaneRow
      leading={
        <DesignThumbnail
          ownerId={tree.ownerId}
          designId={doc.id}
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
          <DesignTagDots tags={tags} />
        </span>
      }
      label={local ? `${name}. ${THIS_BROWSER_DESCRIPTION}` : name}
      meta={`Updated ${relativeSince(doc.savedAt, now)}`}
      current={current}
      onActivate={open}
      className={tree.exitingDesignIds.has(doc.id) ? 'animate-slide-row-out overflow-hidden' : ''}
      rowProps={{
        onContextMenu: menu.onContextMenu,
        ...(draggable
          ? {
              draggable: true,
              onDragStart: (e: React.DragEvent) =>
                startDesignDrag(e.dataTransfer, { id: doc.id, localOnly: local }),
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
