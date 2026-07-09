'use client';

// Pieces shared by the Explorer's list row (explorer-route-diagram-row)
// and card (CardView): the visibility badge, the actions menu, and the
// open-href helper. Extracted so the two view modes can't drift on what
// a diagram's badge says or which actions its menu offers.

import { SharedDotIcon } from '@/components/chrome/share-state-icons';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { Tooltip } from '@/components/primitives/Tooltip';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { saveOfflineToCloud, takeCloudOffline } from '@/lib/offline/offline-convert';
import {
  CloseIcon,
  DiagramIcon,
  MenuDuplicateIcon,
  MenuFolderIcon,
  MenuPencilIcon,
  MenuTrashIcon,
  TeamIcon,
} from './icons';
import type { PaneDiagram } from './views';

// Shared diagrams open on the visitor URL (the owner-only path 404s for
// a non-owner); everything else opens on the owned path.
export function hrefForDiagram(diagram: PaneDiagram): string {
  return diagram.shared
    ? `/diagram/${diagram.id}?s=${encodeURIComponent(diagram.shared.shareCode)}`
    : `/diagram/${diagram.id}`;
}

const badgeBase =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1';

// The visibility badge: Offline (saved only in this browser, spec/76), Shared
// (a shared-with-me row / a share-link owned row), Team, or Private. Each
// carries a concise hover tooltip explaining what the state means. Offline
// wins first — an offline diagram is never shared or in a team.
export function VisibilityBadge({ diagram }: { diagram: PaneDiagram }) {
  if (diagram.ownerId === OFFLINE_OWNER_ID) {
    return (
      <Tooltip title="Offline" description="Saved only in this browser. Not synced or backed up.">
        <span
          className={`${badgeBase} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2.4 6.6h3.4a1.4 1.4 0 0 0 .2-2.8 1.9 1.9 0 0 0-3.3-.5A1.35 1.35 0 0 0 2.4 6.6Z" />
            <path d="M1.4 1.4l6.2 6.2" />
          </svg>
          Offline
        </span>
      </Tooltip>
    );
  }
  if (diagram.shared || diagram.shareCode) {
    return (
      <Tooltip title="Shared" description="Anyone with the link can open it.">
        <span
          className={`${badgeBase} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
        >
          <SharedDotIcon />
          Shared
        </span>
      </Tooltip>
    );
  }
  if (diagram.team) {
    return (
      <Tooltip
        title="Team"
        description="In a team library, so every member of the team can open it."
      >
        <span
          className={`${badgeBase} bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30`}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="3.2" cy="3.2" r="1.4" />
            <path d="M1.2 7.8c.3-1.4 1-2.1 2-2.1s1.7.7 2 2.1" />
            <circle cx="6.6" cy="3.6" r="1.1" />
            <path d="M6.3 5.7c.9.1 1.5.7 1.7 1.8" />
          </svg>
          Team
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Private" description="Only visible to you.">
      <span
        className={`${badgeBase} bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700`}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="1.6" y="4" width="5.8" height="3.6" rx="0.9" />
          <path d="M3 4V2.9a1.5 1.5 0 0 1 3 0V4" />
        </svg>
        Private
      </span>
    </Tooltip>
  );
}

// The actions menu shared by the row + card. Anchored to the trigger the
// caller passes. Shared-with-me rows get Open / Dismiss; owned + team
// rows get the full rename / duplicate / change-folder / (open team) /
// delete set (spec/35).
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
}: {
  diagram: PaneDiagram;
  anchor: HTMLElement | null;
  // Viewer id for Offline Mode conversions (spec/76).
  ownerId: string | null;
  onClose: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  onDelete: () => void;
  onDismiss?: () => void;
}) {
  const href = hrefForDiagram(diagram);
  const offline = diagram.ownerId === OFFLINE_OWNER_ID;
  // Conversions (spec/76). Reload after so the list reflects the move.
  const syncToCloud = async () => {
    if (!ownerId) return;
    onClose();
    try {
      await saveOfflineToCloud(diagram.id, ownerId);
      window.location.reload();
    } catch {
      /* stays offline */
    }
  };
  const takeOffline = async () => {
    if (!ownerId) return;
    onClose();
    const ok = window.confirm(
      `Take “${diagram.name}” offline?\n\nThis removes it from your account and every other device. It will exist only in this browser, with no backup.`,
    );
    if (!ok) return;
    try {
      await takeCloudOffline(diagram.id, ownerId, diagram.shareCode ?? null);
      window.location.reload();
    } catch {
      /* stays on server */
    }
  };
  if (diagram.shared) {
    return (
      <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
        <MenuItem
          icon={<DiagramIcon />}
          label="Open"
          onClick={() => window.location.assign(href)}
        />
        <MenuItem
          icon={<CloseIcon />}
          label="Dismiss"
          onClick={() => {
            onDismiss?.();
            onClose();
          }}
        />
      </PortalMenu>
    );
  }
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
      <MenuItem
        icon={<MenuPencilIcon />}
        label="Rename"
        onClick={() => {
          onStartRename();
          onClose();
        }}
      />
      <MenuItem
        icon={<MenuDuplicateIcon />}
        label="Duplicate"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      />
      <MenuItem
        icon={<MenuFolderIcon />}
        label="Change Folder"
        onClick={() => {
          onMove(anchor);
          onClose();
        }}
      />
      {diagram.team ? (
        <MenuItem
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
          <MenuItem icon={<SyncIcon />} label="Sync Diagram" onClick={() => void syncToCloud()} />
        ) : (
          <MenuItem
            icon={<TakeOfflineMenuIcon />}
            label="Take Offline"
            onClick={() => void takeOffline()}
          />
        )
      ) : null}
      <MenuItem
        icon={<MenuTrashIcon />}
        label="Delete"
        danger
        onClick={() => {
          onDelete();
          onClose();
        }}
      />
    </PortalMenu>
  );
}

// Cloud-up (sync to account) + download-to-device (take offline) icons,
// matching the menu's icon size (spec/76).
function SyncIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 12.5h6.5a2.6 2.6 0 0 0 .3-5.2 3.6 3.6 0 0 0-6.7-.8A2.5 2.5 0 0 0 4.5 12.5Z" />
      <path d="M8 11V7m0 0L6.6 8.4M8 7l1.4 1.4" />
    </svg>
  );
}

function TakeOfflineMenuIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5v6m0 0L5.6 6.1M8 8.5l2.4-2.4" />
      <path d="M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
