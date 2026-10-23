'use client';

// The editor's Explorer's Current Document card (docs/specs/013-workspace/explorer-structure.md "Layout"): the open
// document's thumbnail, name and last save, its visibility badge and its menu at the right. Clicking the name renames
// it in place for someone who may (`onRename`); for anyone else it is plain text.
import { useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { DocumentActionsMenu } from '@/app/explorer/document-row-shared';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { SharedBadge } from '@/components/chrome/SharedBadge';
import { useDocumentVisibility } from '@/hooks/editor/document-visibility-store';
import { PencilIcon } from '@/components/primitives/explorer-icons';
import type { DocumentListItem } from '@/lib/api-client';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';

export function ExplorerCurrentDocument({
  item,
  ownerId,
  thumbnailShareCode,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  onMoveRequest,
}: {
  item: DocumentListItem;
  ownerId: string | null;
  thumbnailShareCode?: string | null;
  onOpen: () => void;
  onRename?: (name: string) => void;
  onDelete?: (anchor: HTMLElement | null) => void;
  onDuplicate?: () => void;
  onMoveRequest?: (anchor: HTMLElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hasMenu = Boolean(onRename || onDelete || onDuplicate || onMoveRequest);
  const menu = useRowMenu({ disabled: !hasMenu || editing });
  const visibility = useDocumentVisibility();
  const relative = relativeSince(item.savedAt, useRelativeNow());
  const name = item.name || 'Untitled document';
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed && trimmed !== item.name) onRename?.(trimmed);
    setEditing(false);
  };
  return (
    <section
      aria-label="Current document"
      onContextMenu={menu.onContextMenu}
      className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
    >
      <span className="shrink-0 [&>*]:!h-14 [&>*]:!w-20">
        <DocumentThumbnail
          ownerId={ownerId}
          documentId={item.id}
          version={item.savedAt}
          empty={item.empty}
          shareCode={thumbnailShareCode ?? item.shareCode}
          offline={item.ownerId === OFFLINE_OWNER_ID}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* The badge rides the label's row and the menu the date's, so the name has the card's whole width (a
            phone's banner left it a dozen characters beside a column of both). */}
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current Document
          </span>
          {visibility ? (
            <SharedBadge
              shareable={visibility.shareable}
              team={visibility.team}
              offline={visibility.offline}
              onManage={visibility.onManage}
              portal
            />
          ) : null}
        </span>
        {editing ? (
          <InlineRenameInput
            initial={item.name}
            ariaLabel={`Rename ${item.name}`}
            onCommit={commit}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-900 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-50"
          />
        ) : onRename ? (
          // Fitted to the name: hovering underlines it and shows the pencil, never a block of fill.
          <button
            type="button"
            aria-label={`Rename ${name}`}
            onClick={() => setEditing(true)}
            className="group/name flex max-w-full cursor-pointer items-center gap-1.5 self-start rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900 decoration-slate-400 decoration-dotted underline-offset-4 group-hover/name:underline dark:text-slate-50 dark:decoration-slate-500">
              {name}
            </span>
            <span
              aria-hidden
              className="shrink-0 text-slate-400 opacity-0 transition group-hover/name:opacity-100 group-focus-visible/name:opacity-100 dark:text-slate-400"
            >
              <PencilIcon size={12} />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-current="true"
            className="min-w-0 self-start truncate text-left text-[15px] font-semibold text-slate-900 dark:text-slate-50"
          >
            {name}
          </button>
        )}
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            Updated {relative}
          </span>
          {hasMenu && !editing ? (
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              className="-my-1 shrink-0"
              label="Document menu"
            />
          ) : null}
        </span>
      </span>
      {menu.open ? (
        <DocumentActionsMenu
          document={item}
          anchor={menu.triggerRef.current}
          ownerId={ownerId}
          onClose={menu.close}
          isOpen
          onOpen={onOpen}
          onStartRename={onRename ? () => setEditing(true) : undefined}
          onDuplicate={onDuplicate}
          onMove={
            onMoveRequest ? (anchor) => onMoveRequest(anchor ?? menu.triggerRef.current) : undefined
          }
          onDelete={onDelete ? () => onDelete(menu.triggerRef.current) : undefined}
        />
      ) : null}
    </section>
  );
}
