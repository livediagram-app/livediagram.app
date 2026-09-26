'use client';

// Pieces shared by the Explorer's list row (explorer-route-diagram-row)
// and card (CardView): the actions menu (and the entry-props binding of
// it), the owner label, and the open-href helper. The badges they show
// live beside this, in diagram-badges.
// Extracted so the two view modes can't drift on what a diagram's badge
// says or which actions its menu offers.

import { CloseIcon } from '@livediagram/ui';
import {
  ClockIcon,
  ClockOffIcon,
  DiagramIcon,
  DuplicateIcon,
  FolderOutlineIcon,
  HistoryIcon,
  PencilIcon,
  ShareIcon,
  StarIcon,
  SyncIcon,
  TakeOfflineIcon,
  TeamIcon,
  TrashIcon,
} from '@/components/primitives/explorer-icons';
import { DismissSharedIcon } from '@/components/primitives/dismiss-shared';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { useOfflineConversion } from '@/hooks/persistence/useOfflineConversion';
import type { PaneDiagram } from './views';
import type { DiagramEntryProps } from './explorer-view-props';
import { VisibilityBadge } from './diagram-badges';

// Shared diagrams open on the visitor URL (the owner-only path 404s for
// a non-owner); everything else opens on the owned path.
export function hrefForDiagram(diagram: PaneDiagram): string {
  return diagram.shared
    ? `/diagram/${diagram.id}?s=${encodeURIComponent(diagram.shared.shareCode)}`
    : `/diagram/${diagram.id}`;
}

// Who a row's Owner cell names: the team for a team diagram, the sharer
// for one shared with you, otherwise you.
export function ownerLabelFor(diagram: PaneDiagram): string {
  return (
    diagram.team?.name ?? diagram.shared?.ownerName ?? (diagram.shared ? 'Unknown owner' : 'You')
  );
}

// The actions menu shared by the row + card. Anchored to the trigger the
// caller passes. Shared-with-me rows get Open / Dismiss; owned + team
// rows get the full rename / duplicate / change-folder / (open team) /
// delete set (docs/specs/013-workspace/team-shared-diagrams.md).
//
// Shape: a header naming the diagram, then one full-width row per verb
// with its icon on the left, and Delete last under a separator. It was
// a tile grid (icon over label, two then three columns); eight verbs in
// a grid meant reading in two directions with labels wrapping under
// their icons, and a list of verbs scans down in one. Delete is red at
// rest so the one irreversible verb is found before it's read.
export function DiagramActionsMenu({
  diagram,
  anchor,
  ownerId,
  onClose,
  onStartRename,
  onDuplicate,
  onMove,
  onDelete,
  onDismiss,
  recentExcluded,
  onToggleRecentExclusion,
  onShowHistory,
  favourite,
  onToggleFavourite,
  isOpen = false,
  onOpen,
  onRemoveFromTimeline,
  onShare,
}: {
  diagram: PaneDiagram;
  anchor: HTMLElement | null;
  // Viewer id for Offline Mode conversions (docs/specs/006-diagram/offline-mode.md).
  ownerId: string | null;
  onClose: () => void;
  // Every verb is optional: a row renders only when its handler is passed,
  // so a surface that can't offer one (the floating panel can't rename a
  // row that isn't the open diagram) leaves it out rather than showing a
  // row that does nothing.
  onStartRename?: () => void;
  onDuplicate?: () => void;
  onMove?: (anchor: HTMLElement | null) => void;
  onDelete?: () => void;
  onDismiss?: () => void;
  // Hide / show in Recent (docs/specs/013-workspace/hide-from-recent.md). Per-user, so the label reflects THIS
  // viewer's state; omitted where the surface can't offer it.
  recentExcluded?: boolean;
  onToggleRecentExclusion?: () => void;
  onShowHistory?: () => void;
  // Per-user star (docs/specs/013-workspace/favourites.md). Personal + team diagrams only; a
  // shared-with-you row isn't in your library to star.
  favourite?: boolean;
  onToggleFavourite?: () => void;
  // True on the row for the diagram already open in this editor session,
  // where an Open verb would do nothing. Everywhere else the menu leads
  // with Open.
  isOpen?: boolean;
  // How to open it. Absent = navigate to the diagram's page; the floating
  // panel passes its own opener so switching diagrams stays in-editor.
  onOpen?: () => void;
  // Timeline only (docs/specs/013-workspace/timeline.md §2.9): take THIS card off the reader's feed.
  // Says nothing about the diagram, so it sits with the other "how you
  // see it" verbs, not with Delete.
  onRemoveFromTimeline?: () => void;
  // Open the diagram with its Share dialog already up (the editor
  // honours `?share=1`). Offered where a reader is likely to be looking
  // at sharing — the Timeline's share-link cards — rather than everywhere.
  onShare?: () => void;
}) {
  const href = hrefForDiagram(diagram);
  const offline = diagram.ownerId === OFFLINE_OWNER_ID;
  // Offline Mode conversions (docs/specs/006-diagram/offline-mode.md), shared with the panel row via the hook.
  const { syncToCloud, takeOffline } = useOfflineConversion(diagram, ownerId, onClose);
  // Run a verb, then close: every row does this, so it's one wrapper.
  const then = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const header = <MenuHeader title={diagram.name} aside={<VisibilityBadge diagram={diagram} />} />;

  if (diagram.shared) {
    return (
      <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
        {header}
        <MenuActionRow
          plain
          icon={<DiagramIcon />}
          label="Open"
          onClick={() => window.location.assign(href)}
        />
        <MenuGroupSeparator />
        {onRemoveFromTimeline ? (
          <MenuActionRow
            plain
            icon={<CloseIcon size={11} strokeWidth={1.8} />}
            label="Remove from Timeline"
            onClick={then(onRemoveFromTimeline)}
          />
        ) : null}
        <MenuActionRow
          plain
          danger
          icon={<DismissSharedIcon />}
          label="Dismiss"
          onClick={then(() => onDismiss?.())}
        />
      </PortalMenu>
    );
  }
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
      {header}
      {/* Open leads, on its own, unless this IS the open diagram: the
          verb people reach for first sits first, and a menu on the
          current diagram's row doesn't offer a no-op. */}
      {isOpen ? null : (
        <>
          <MenuActionRow
            plain
            icon={<DiagramIcon />}
            label="Open"
            onClick={onOpen ? then(onOpen) : () => window.location.assign(href)}
          />
          {onShare ? (
            <MenuActionRow plain icon={<ShareIcon />} label="Share" onClick={then(onShare)} />
          ) : null}
          <MenuGroupSeparator />
        </>
      )}
      {onStartRename ? (
        <MenuActionRow
          plain
          icon={<PencilIcon size={12} />}
          label="Rename"
          onClick={then(onStartRename)}
        />
      ) : null}
      {onDuplicate ? (
        <MenuActionRow
          plain
          icon={<DuplicateIcon size={12} />}
          label="Duplicate"
          onClick={then(onDuplicate)}
        />
      ) : null}
      {onMove ? (
        <MenuActionRow
          plain
          icon={<FolderOutlineIcon />}
          label="Change Folder"
          onClick={then(() => onMove(anchor))}
        />
      ) : null}
      {/* Two groups: what changes the diagram itself (rename, copy, file),
          then what changes how YOU see it (star, history, Recent,
          where it's stored). */}
      {onStartRename || onDuplicate || onMove ? <MenuGroupSeparator /> : null}
      {onToggleFavourite ? (
        <MenuActionRow
          plain
          icon={<StarIcon filled={favourite} />}
          label={favourite ? 'Unfavourite' : 'Favourite'}
          onClick={then(onToggleFavourite)}
        />
      ) : null}
      {onShowHistory ? (
        <MenuActionRow plain icon={<HistoryIcon />} label="History" onClick={then(onShowHistory)} />
      ) : null}
      {onToggleRecentExclusion ? (
        <MenuActionRow
          plain
          icon={recentExcluded ? <ClockOffIcon /> : <ClockIcon />}
          // The label states what the click DOES, and by doing so tells
          // you the current state — which is why the diagram needs no
          // badge anywhere else (docs/specs/013-workspace/hide-from-recent.md).
          label={recentExcluded ? 'Show in Recent' : 'Hide from Recent'}
          onClick={then(onToggleRecentExclusion)}
        />
      ) : null}
      {diagram.team ? (
        <MenuActionRow
          plain
          icon={<TeamIcon />}
          label="Open Team"
          onClick={() => {
            window.location.assign(
              `/explorer/team?id=${encodeURIComponent(diagram.team!.id)}${
                diagram.folderId ? `&folder=${encodeURIComponent(diagram.folderId)}` : ''
              }`,
            );
          }}
        />
      ) : null}
      {ownerId ? (
        offline ? (
          <MenuActionRow
            plain
            icon={<SyncIcon />}
            label="Sync Diagram"
            onClick={() => void syncToCloud()}
          />
        ) : (
          <MenuActionRow
            plain
            icon={<TakeOfflineIcon />}
            label="Take Offline"
            onClick={() => void takeOffline()}
          />
        )
      ) : null}
      {onRemoveFromTimeline ? (
        <MenuActionRow
          plain
          icon={<CloseIcon size={11} strokeWidth={1.8} />}
          label="Remove from Timeline"
          onClick={then(onRemoveFromTimeline)}
        />
      ) : null}
      {onDelete ? (
        <>
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            danger
            icon={<TrashIcon size={12} />}
            label="Delete"
            onClick={then(onDelete)}
          />
        </>
      ) : null}
    </PortalMenu>
  );
}

// DiagramActionsMenu bound to a list row's or card's entry props. Both
// entries hand the menu the same fourteen bindings; this is them once.
export function DiagramEntryMenu({
  entry,
  anchor,
  onClose,
}: {
  entry: DiagramEntryProps;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  return (
    <DiagramActionsMenu
      diagram={entry.diagram}
      anchor={anchor}
      ownerId={entry.ownerId}
      onClose={onClose}
      onStartRename={entry.onStartRename}
      onDuplicate={entry.onDuplicate}
      onMove={entry.onMove}
      onDelete={entry.onDelete}
      onDismiss={entry.onDismiss}
      favourite={entry.favourite}
      onToggleFavourite={entry.onToggleFavourite}
      recentExcluded={entry.recentExcluded}
      onToggleRecentExclusion={entry.onToggleRecentExclusion}
      onShowHistory={entry.onShowHistory}
    />
  );
}
