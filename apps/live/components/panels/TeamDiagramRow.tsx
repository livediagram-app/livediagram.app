import Link from 'next/link';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRef, useState } from 'react';
import type { DiagramSummary } from '@livediagram/api-schema';
import {
  MenuDuplicateIcon,
  MenuFolderIcon,
  MenuPencilIcon,
  MenuTrashIcon,
} from '@/app/explorer/icons';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { MenuItem, PortalMenu } from '@/components/primitives/PortalMenu';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { relativeSince } from '@/lib/relative-time';

// One team-library diagram row (spec/35), lifted out of
// TeamSharedDiagrams: thumbnail + name link (or the inline rename), the
// relative save time, and the ellipsis menu (rename / duplicate /
// change folder / delete). Every mutation comes through the parent's
// handlers.
export function TeamDiagramRow({
  diagram,
  ownerId,
  renaming,
  onMove,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  diagram: DiagramSummary;
  // Viewer identity for the thumbnail fetch (spec/67). A team diagram
  // has no share code; the authed fetch authorises via team membership.
  ownerId: string | null;
  renaming: boolean;
  onMove: (anchor: HTMLElement | null) => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  return (
    <li className="group grid grid-cols-[1fr_140px_40px] items-center gap-2 px-4 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
      <span className="flex min-w-0 items-center gap-2">
        <DiagramThumbnail ownerId={ownerId} diagramId={diagram.id} version={diagram.savedAt} />
        {renaming ? (
          <InlineRenameInput
            initial={diagram.name}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
            className="rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <Link
            href={`/diagram/${diagram.id}`}
            className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {diagram.name}
          </Link>
        )}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {relativeSince(diagram.savedAt)}
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton
          ref={menuRef}
          label={`Menu for ${diagram.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        />
      )}
      {menuOpen ? (
        <PortalMenu anchor={menuRef.current} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Change Folder"
            onClick={() => {
              onMove(menuRef.current);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}
