'use client';

// The details layout (liveplanner's Details view, simplified): a table of the loaded items with the columns
// the index knows (kind, comments, access, size, created, updated), sortable by a header press. Sorting is
// over what is loaded; the rows are windowed like the list's.

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { LIST_CARD } from '../ui/classes';
import { RelativeTimeChip } from '../ui/RelativeTimeChip';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FolderSolidIcon } from '../ui/icons';
import { kindWords } from '../words';
import { AppMark, FavouriteMarker } from './badges';
import { DROP_ROW, useDropTarget, useFolderDrag, useItemDrag } from '../drag/drag';
import { useExplorer } from './context';
import { ItemMenu } from './menus';
import { ROW_HEIGHT, type RowOptions } from './rows';
import { useWindowedRange } from './useWindow';

type SortKey = 'title' | 'kind' | 'comments' | 'access' | 'bytes' | 'createdAt' | 'updatedAt';

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'title', label: 'Name', className: '' },
  { key: 'kind', label: 'Type', className: 'hidden md:block' },
  { key: 'comments', label: 'Comments', className: 'hidden md:block text-right' },
  { key: 'access', label: 'Access', className: 'hidden sm:block' },
  { key: 'bytes', label: 'Size', className: 'hidden lg:block text-right' },
  { key: 'createdAt', label: 'Created', className: 'hidden lg:block' },
  { key: 'updatedAt', label: 'Updated', className: '' },
];

const GRID =
  'grid grid-cols-[1fr_110px_40px] sm:grid-cols-[1fr_80px_110px_40px] md:grid-cols-[1fr_90px_80px_80px_110px_40px] lg:grid-cols-[1fr_90px_80px_80px_70px_110px_110px_40px]';

const ACCESS_WORD = { view: 'View', participate: 'Participate', edit: 'Edit' } as const;

function sortValue(item: ShownItem, key: SortKey): string | number {
  switch (key) {
    case 'title':
      return item.title.toLowerCase();
    case 'kind':
      return item.kind;
    case 'comments':
      return item.summary.comments ?? 0;
    case 'access':
      return item.access;
    case 'bytes':
      return item.summary.bytes ?? 0;
    case 'createdAt':
      return item.createdAt;
    case 'updatedAt':
      return item.updatedAt;
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DetailsView({
  folders,
  items,
  options,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  folders: Folder[];
  items: ShownItem[];
  options: RowOptions;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const sorted = useMemo(() => {
    if (sort.key === 'updatedAt' && sort.dir === -1) return items;
    const keyed = items.map((i) => [sortValue(i, sort.key), i] as const);
    keyed.sort((a, b) => (a[0] < b[0] ? -sort.dir : a[0] > b[0] ? sort.dir : 0));
    return keyed.map(([, i]) => i);
  }, [items, sort]);
  const body = useRef<HTMLUListElement>(null);
  const count = folders.length + sorted.length;
  const range = useWindowedRange(body, count, ROW_HEIGHT);
  // The range trails a shrinking list by one render (an item trashed): clamp it to what is there.
  const end = Math.min(range.end, count);
  const start = Math.min(range.start, end);
  useEffect(() => {
    if (hasMore && !loadingMore && end >= count - 40) onLoadMore();
  }, [end, count, hasMore, loadingMore, onLoadMore]);

  const rows = [];
  for (let i = start; i < end; i++) {
    if (i < folders.length) {
      const f = folders[i]!;
      rows.push(<DetailsFolderRow key={`f:${f.id}`} folder={f} />);
    } else {
      const item = sorted[i - folders.length]!;
      rows.push(<DetailsRow key={item.id} item={item} options={options} />);
    }
  }

  return (
    <div className={LIST_CARD}>
      <div
        role="row"
        className={`${GRID} items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400`}
      >
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="columnheader"
            aria-sort={
              sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined
            }
            onClick={() =>
              setSort((s) =>
                s.key === c.key
                  ? { key: c.key, dir: s.dir === 1 ? -1 : 1 }
                  : { key: c.key, dir: c.key === 'title' || c.key === 'kind' ? 1 : -1 },
              )
            }
            className={`uppercase hover:text-slate-800 dark:hover:text-slate-200 ${c.className} text-left`}
          >
            {c.label}
            {sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
        <span aria-hidden />
      </div>
      <ul ref={body} className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {start > 0 ? <li aria-hidden style={{ height: start * ROW_HEIGHT }} /> : null}
        {rows}
        {end < count ? <li aria-hidden style={{ height: (count - end) * ROW_HEIGHT }} /> : null}
      </ul>
    </div>
  );
}

const DetailsFolderRow = memo(function DetailsFolderRow({ folder: f }: { folder: Folder }) {
  const { navigate } = useExplorer();
  const drop = useDropTarget({ teamId: f.teamId, folderId: f.id });
  const drag = useFolderDrag(f);
  return (
    <li
      data-folder-row={f.id}
      data-drop-over={drop.over || undefined}
      className={`${GRID} items-center gap-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-700 ${drop.over ? DROP_ROW : ''}`}
      style={{ height: ROW_HEIGHT }}
      {...drop.handlers}
      {...drag}
    >
      <button
        type="button"
        onClick={() =>
          navigate(
            f.teamId
              ? { kind: 'team', id: f.teamId, folderId: f.id }
              : { kind: 'folder', id: f.id },
          )
        }
        className="flex min-w-0 items-center gap-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100"
      >
        <span className="shrink-0 text-amber-500">
          <FolderSolidIcon />
        </span>
        <span className="truncate">{f.name}</span>
      </button>
    </li>
  );
});

const DetailsRow = memo(function DetailsRow({
  item,
  options,
}: {
  item: ShownItem;
  options: RowOptions;
}) {
  const { Link, itemHref } = useExplorer();
  const menu = useRowMenu();
  const drag = useItemDrag(item);
  const title = item.title || 'Untitled';
  return (
    <li
      data-item-row={item.id}
      className={`${GRID} group items-center gap-2 px-4 transition hover:bg-slate-50 dark:hover:bg-slate-700`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
      {...drag}
    >
      <span className="flex min-w-0 items-center gap-2">
        {options.showApp ? <AppMark app={item.app} /> : null}
        {item.favourite ? <FavouriteMarker /> : null}
        <Link
          href={itemHref(item)}
          className="truncate text-sm font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
        >
          {title}
        </Link>
      </span>
      <span className="hidden truncate text-xs text-slate-600 md:block dark:text-slate-300">
        {kindWords(item.app).one}
      </span>
      <span className="hidden text-right text-xs tabular-nums text-slate-600 md:block dark:text-slate-300">
        {item.summary.comments ?? 0}
      </span>
      <span className="hidden text-xs text-slate-600 sm:block dark:text-slate-300">
        {ACCESS_WORD[item.access]}
      </span>
      <span className="hidden text-right text-xs tabular-nums text-slate-600 lg:block dark:text-slate-300">
        {formatBytes(item.summary.bytes)}
      </span>
      <span className="hidden lg:block">
        <RelativeTimeChip at={item.createdAt} />
      </span>
      <span className="flex min-w-0 items-center">
        <RelativeTimeChip at={item.updatedAt} />
      </span>
      <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${title}`} />
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});
