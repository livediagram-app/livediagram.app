'use client';

// Pieces shared by the Explorer's list row (explorer-route-diagram-row)
// and card (CardView): the visibility badge, the actions menu, and the
// open-href helper. Extracted so the two view modes can't drift on what
// a diagram's badge says or which actions its menu offers.

import { SharedDotIcon } from '@/components/chrome/share-state-icons';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
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

// The visibility badge: Shared (a shared-with-me row, a share-link owned
// row), Team, or Private. Same precedence the row has always used.
export function VisibilityBadge({ diagram }: { diagram: PaneDiagram }) {
  if (diagram.shared || diagram.shareCode) {
    return (
      <span
        className={`${badgeBase} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30`}
      >
        <SharedDotIcon />
        Shared
      </span>
    );
  }
  if (diagram.team) {
    return (
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
    );
  }
  return (
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
  );
}

// The actions menu shared by the row + card. Anchored to the trigger the
// caller passes. Shared-with-me rows get Open / Dismiss; owned + team
// rows get the full rename / duplicate / change-folder / (open team) /
// delete set (spec/35).
export function DiagramActionsMenu({
  diagram,
  anchor,
  onClose,
  onStartRename,
  onDuplicate,
  onMove,
  onDelete,
  onDismiss,
}: {
  diagram: PaneDiagram;
  anchor: HTMLElement | null;
  onClose: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  onDelete: () => void;
  onDismiss?: () => void;
}) {
  const href = hrefForDiagram(diagram);
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
