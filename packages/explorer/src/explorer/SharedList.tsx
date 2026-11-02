'use client';

// Shared With Me (liveplanner's SharedList): what others shared with the person through a link, one fixed list.
// Name, the Owner (their display name from accounts), the Role the link gives as a chip, when it changed, and a
// Dismiss × that asks first and takes it off the list (the link still opens it). Windowed like the list.

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Folder, Level } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { ConfirmDialog } from '@liveworkspace/ui';
import { LIST_CARD, LIST_HEADER } from '../ui/classes';
import { DismissIcon, ItemIcon } from '../ui/icons';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { useCascade } from '../ui/useCascade';
import { rowKeys, useFocusAfterRemoval } from '../ui/useFocusAfterRemoval';
import { AppMark, MadeByAiBadge } from './badges';
import { useExplorer } from './context';
import { useExtras } from './extras';
import { ItemMenu } from './menus';
import { ROW_HEIGHT, useItemBits, useOwnerLabel, type RowOptions } from './rows';
import { useWindowedRange } from './useWindow';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { quoted } from '../quoted';

// What the link lets the person do, as its chip says it (share-roles.md).
export const ROLE_CHIP: Record<Level, string> = {
  edit: 'Edit',
  participate: 'Participate',
  view: 'View',
};

const GRID =
  'grid grid-cols-[1fr_80px_32px_32px] sm:grid-cols-[1fr_120px_80px_140px_32px_32px] items-center gap-2';

const LOAD_AHEAD = 40;

export function SharedList({
  items,
  options,
  hasMore,
  loadingMore,
  onLoadMore,
  resetKey = '',
}: {
  folders?: Folder[];
  items: ShownItem[];
  options: RowOptions;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  resetKey?: string;
}) {
  const { actions } = useExplorer();
  const body = useRef<HTMLUListElement>(null);
  const cascade = useCascade(resetKey);
  const count = items.length;
  const range = useWindowedRange(body, count, ROW_HEIGHT);
  useFocusAfterRemoval(
    body,
    useMemo(() => rowKeys([], items), [items]),
  );
  const end = Math.min(range.end, count);
  const start = Math.min(range.start, end);
  const [dismissing, setDismissing] = useState<ShownItem | null>(null);
  useEffect(() => {
    if (hasMore && !loadingMore && end >= count - LOAD_AHEAD) onLoadMore();
  }, [end, count, hasMore, loadingMore, onLoadMore]);
  const rows = useMemo(() => items.slice(start, end), [items, start, end]);
  return (
    <div className={LIST_CARD}>
      <div className={`${GRID} ${LIST_HEADER}`}>
        <span>Name</span>
        <span className="hidden sm:block">Owner</span>
        <span>Role</span>
        <span className="hidden sm:block">Updated</span>
        <span aria-hidden />
        <span aria-hidden />
      </div>
      <ul
        ref={body}
        aria-rowcount={count}
        className={`divide-y divide-slate-100 dark:divide-slate-700/60 ${cascade ? 'lw-cascade' : ''}`}
      >
        {start > 0 ? <li aria-hidden style={{ height: start * ROW_HEIGHT }} /> : null}
        {rows.map((item) => (
          <SharedRow key={item.id} item={item} options={options} onDismiss={setDismissing} />
        ))}
        {end < count ? <li aria-hidden style={{ height: (count - end) * ROW_HEIGHT }} /> : null}
      </ul>
      {loadingMore ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
          Loading more…
        </p>
      ) : null}
      {dismissing ? (
        <ConfirmDialog
          open
          title={`Dismiss ${quoted(dismissing.title || 'Untitled')}?`}
          message="It leaves your Shared With Me list. Its link still opens it, and opening it again brings it back."
          confirmLabel="Dismiss"
          onCancel={() => setDismissing(null)}
          onConfirm={() => {
            const item = dismissing;
            setDismissing(null);
            void actions.dismissShared(item);
          }}
        />
      ) : null}
    </div>
  );
}

const SharedRow = memo(function SharedRow({
  item,
  options,
  onDismiss,
}: {
  item: ShownItem;
  options: RowOptions;
  onDismiss: (item: ShownItem) => void;
}) {
  const { Link, renderThumbnail } = useExplorer();
  const { leaving } = useExtras();
  const bits = useItemBits(item);
  const owner = useOwnerLabel(item, true);
  const menu = useRowMenu();
  const title = item.title || 'Untitled';
  const thumb = renderThumbnail?.(item, 'row');
  return (
    <li
      data-item-row={item.id}
      data-shared-row=""
      className={`${GRID} group px-4 transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
        leaving.has(item.id) ? 'lw-row-out' : ''
      }`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
    >
      <span className="flex min-w-0 items-center gap-2">
        {options.showApp ? <AppMark app={item.app} /> : null}
        {thumb ? (
          <span className="h-7 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
            {thumb}
          </span>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-400">
            <ItemIcon />
          </span>
        )}
        <Link
          href={bits.href}
          className="truncate text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
        >
          {title}
        </Link>
        <MadeByAiBadge item={item} />
      </span>
      <span
        data-owner=""
        className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400"
      >
        {owner}
      </span>
      <span
        data-role-chip=""
        className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
      >
        {ROLE_CHIP[item.access]}
      </span>
      <span className="hidden min-w-0 items-center sm:flex">
        <RelativeTimeChip at={item.updatedAt} />
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item)}
        aria-label={`Dismiss ${title} from Shared With Me`}
        title="Dismiss: drop this from your Shared With Me list."
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-200"
      >
        <DismissIcon size={11} />
      </button>
      <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${title}`} />
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});
