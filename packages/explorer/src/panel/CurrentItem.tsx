'use client';

import { useState, type ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { useExplorer } from '../explorer/context';
import { VisibilityBadge } from '../explorer/badges';
import { ItemMenu } from '../explorer/menus';
import { LocalPreview, ThisBrowserItemMenu, ThisBrowserPill } from '../explorer/ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { ItemIcon, PencilIcon } from '../ui/icons';
import { relativeSince, useNow } from '../time';

// ---- The current item's card ----------------------------------------------------------------------------

// The open item as the index has it: its picture, visibility badge and the Explorer's item menu, renamed through
// the index (the editor's title follows, onItemRenamed).
export function CurrentItem({ item: base, compact = false }: { item: Item; compact?: boolean }) {
  const { overlay, renderThumbnail, actions, openItem, renamingId, setRenamingId } = useExplorer();
  const item = overlay.apply(base);
  // Its pencil, or Rename on its menu (which names it for renaming, as every row's does).
  const [pencil, setPencil] = useState(false);
  const editing = pencil || renamingId === item.id;
  const setEditing = (on: boolean) => {
    setPencil(on);
    if (!on && renamingId === item.id) setRenamingId(null);
  };
  const menu = useRowMenu({ disabled: editing });
  return (
    <CurrentCard
      compact={compact}
      title={item.title}
      updatedAt={item.updatedAt}
      canRename={item.access === 'edit'}
      editing={editing}
      setEditing={setEditing}
      onRename={(title) => void actions.rename(item, title)}
      onOpen={() => openItem(item)}
      thumbnail={renderThumbnail ? renderThumbnail(item, 'card') : <ItemIcon size={18} />}
      badge={<VisibilityBadge item={item} />}
      menu={menu}
    >
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </CurrentCard>
  );
}

// The open item when it lives only in this browser (the index never holds it): drawn from This Browser's list, with
// the app's picture of a local item, the This Browser pill and This Browser's own menu (Open, Sync, Delete). Renaming
// it is the editor's own rename (`onRenameCurrent`), which writes this browser's store; nothing goes to the index.
export function LocalCurrentItem({
  item,
  onRename,
  compact = false,
}: {
  item: ThisBrowserItem;
  onRename?: (title: string) => void;
  compact?: boolean;
}) {
  const { app } = useExplorer();
  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  return (
    <CurrentCard
      compact={compact}
      local
      title={item.title}
      updatedAt={item.updatedAt}
      canRename={Boolean(onRename)}
      editing={editing}
      setEditing={setEditing}
      onRename={(title) => onRename?.(title)}
      thumbnail={<LocalPreview app={app} iconSize={18} className="h-14 w-20 shrink-0" />}
      badge={<ThisBrowserPill />}
      menu={menu}
    >
      {menu.open ? (
        <ThisBrowserItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </CurrentCard>
  );
}

// The card both draw: the picture, the label "Current <Kind>" with the place's badge, the name (click to rename, for
// someone who may), "Updated <relative time>" and the ⋯ menu.
function CurrentCard({
  compact = false,
  local = false,
  title,
  updatedAt,
  canRename,
  editing,
  setEditing,
  onRename,
  onOpen,
  thumbnail,
  badge,
  menu,
  children,
}: {
  // At the top of the panel's sidebar (owner, 2026-11-16): the picture across the card with where it lives on its
  // corner, then the name with its menu, then when it changed. No "Current" label: its place says it.
  compact?: boolean;
  local?: boolean;
  title: string;
  updatedAt: number;
  canRename: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
  onRename: (title: string) => void;
  onOpen?: () => void;
  thumbnail: ReactNode;
  badge: ReactNode;
  menu: ReturnType<typeof useRowMenu>;
  children?: ReactNode;
}) {
  const { kind } = useExplorer();
  const now = useNow();
  const name = title || `Untitled ${kind.lowerOne}`;
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    setEditing(false);
  };
  if (compact)
    return (
      <section
        aria-label={`Current ${kind.lowerOne}`}
        data-current-item={local ? 'this-browser' : 'index'}
        data-current-compact=""
        onContextMenu={menu.onContextMenu}
        className="flex flex-col gap-1.5 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"
      >
        <span className="relative block">
          <span className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-50 text-slate-300 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/70 [&>*]:!h-full [&>*]:!w-full">
            {thumbnail}
          </span>
          {/* Where it lives, on the picture's corner, so the line under the name has its full width. */}
          <span className="absolute left-1.5 top-1.5 flex">{badge}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 px-1 pb-0.5">
          <span className="flex min-h-6 items-center gap-1">
            {editing ? (
              <InlineRenameInput
                initial={title}
                ariaLabel={`Rename ${name}`}
                onCommit={commit}
                onCancel={() => setEditing(false)}
                className="w-full min-w-0 rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] font-semibold text-slate-900 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-50"
              />
            ) : (
              <button
                type="button"
                aria-label={canRename ? `Rename ${name}` : undefined}
                aria-current={canRename ? undefined : 'true'}
                onClick={canRename ? () => setEditing(true) : onOpen}
                title={name}
                className="min-w-0 flex-1 cursor-pointer truncate rounded text-left text-[13px] font-semibold text-slate-900 decoration-slate-400 decoration-dotted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-50 dark:decoration-slate-500"
              >
                {name}
              </button>
            )}
            {!editing ? (
              <EllipsisTriggerButton
                {...menu.triggerProps}
                size="md"
                className="-my-1 -mr-1 shrink-0"
                label={`${kind.one} menu`}
              />
            ) : null}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            Updated {relativeSince(updatedAt, now || Date.now())}
          </span>
        </span>
        {children}
      </section>
    );
  return (
    <section
      aria-label={`Current ${kind.lowerOne}`}
      data-current-item={local ? 'this-browser' : 'index'}
      onContextMenu={menu.onContextMenu}
      className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/60"
    >
      <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-900 [&>*]:!h-14 [&>*]:!w-20">
        {thumbnail}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-h-5 items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current {kind.one}
          </span>
          {badge}
        </span>
        {editing ? (
          <InlineRenameInput
            initial={title}
            ariaLabel={`Rename ${name}`}
            onCommit={commit}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-slate-900 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-50"
          />
        ) : canRename ? (
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
            Updated {relativeSince(updatedAt, now || Date.now())}
          </span>
          {!editing ? (
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              className="-my-1 shrink-0"
              label={`${kind.one} menu`}
            />
          ) : null}
        </span>
      </span>
      {children}
    </section>
  );
}
