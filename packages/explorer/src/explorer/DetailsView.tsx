'use client';

// The details layout (liveplanner's Details view): a table of the folders, then the loaded items, with the columns
// the index knows (type, comments, access, size, created, updated). A header press sorts by a column (folders
// stay first, dashes last) and the choice is kept on the device. Folder rows carry the folder menu, inline rename,
// what they hold and their dates; item rows preview their snapshot after a 600 ms rest and ask the host to load it
// ahead as they come near. Sorting is over what is loaded; the rows are windowed like the list's.

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { FOLDER_PREVIEW_IDS_MAX, type Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { DefaultFolderMarker } from '../defaults/DefaultFolderMarker';
import { DROP_ROW, useDropTarget, useFolderDrag, useItemDrag } from '../drag/drag';
import { LIST_CARD, RENAME_INPUT } from '../ui/classes';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { FolderSolidIcon } from '../ui/icons';
import { useCascade } from '../ui/useCascade';
import { kindWords } from '../words';
import { AppMark, FavouriteMarker, MadeByAiBadge } from './badges';
import { useExplorer } from './context';
import {
  ALIGN_CLASS,
  AccessCell,
  CommentsCell,
  DateCell,
  FolderTypeCell,
  NOT_COUNTED,
  NoValue,
  SHOWN_FROM_CLASS,
  SizeCell,
  TypeCell,
} from './details/details-cells';
import {
  DETAILS_COLUMNS,
  sortDetailsEntries,
  typeLabel,
  type DetailsColumnId,
} from './details/details-columns';
import { formatHeld } from './details/details-format';
import { HoverPreviewCard, useHoverPreview } from './details/HoverPreview';
import { useDetailsSort } from './details/useDetailsSort';
import { useExtras } from './extras';
import { FolderMenu, ItemMenu } from './menus';
import { ROW_HEIGHT, useFolderBits, useItemBits, type RowOptions } from './rows';
import { useWindowedRange } from './useWindow';

// Name, Type, Comments, Access, Size, Created, Updated, the menu: each column shows from its width up.
const GRID =
  'grid items-center gap-2 grid-cols-[1fr_130px_40px] sm:grid-cols-[1fr_40px_120px_130px_40px] md:grid-cols-[1fr_40px_40px_40px_150px_140px_40px] lg:grid-cols-[1fr_40px_40px_40px_150px_140px_140px_40px]';

const CELL = 'min-w-0 items-center';
const cellClass = (id: DetailsColumnId) => {
  const c = DETAILS_COLUMNS.find((x) => x.id === id)!;
  return `${CELL} ${SHOWN_FROM_CLASS[c.shownFrom] || 'flex'} ${ALIGN_CLASS[c.align]}`;
};
const CELLS = Object.fromEntries(DETAILS_COLUMNS.map((c) => [c.id, cellClass(c.id)])) as Record<
  DetailsColumnId,
  string
>;

const LOAD_AHEAD = 40;

export function DetailsView({
  folders,
  items,
  options,
  hasMore,
  loadingMore,
  onLoadMore,
  resetKey = '',
}: {
  folders: Folder[];
  items: ShownItem[];
  options: RowOptions;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  // The list's identity: a new one cascades in.
  resetKey?: string;
}) {
  const { renamingId, client, app, filter, epoch, placedEpoch, words } = useExplorer();
  const [sort, sortBy] = useDetailsSort();
  const cascade = useCascade(resetKey);
  // What each folder holds, for its Size cell and a sort by size (one batched request for this level's folders).
  const folderIds = useMemo(
    () => folders.slice(0, FOLDER_PREVIEW_IDS_MAX).map((f) => f.id),
    [folders],
  );
  const previews = useFolderPreviews({
    client,
    folderIds,
    app: filter === 'all' ? null : app,
    epoch,
    placedEpoch,
  });
  const sorted = useMemo(
    () =>
      sortDetailsEntries({
        folders,
        items,
        sort,
        itemCount: (id) => previews.get(id)?.itemCount,
        kindOne: (item) => kindWords(item.app).one,
      }),
    [folders, items, sort, previews],
  );
  const body = useRef<HTMLUListElement>(null);
  const count = sorted.folders.length + sorted.items.length;
  const range = useWindowedRange(body, count, ROW_HEIGHT);
  // The range trails a shrinking list by one render (an item trashed): clamp it to what is there.
  const end = Math.min(range.end, count);
  const start = Math.min(range.start, end);
  useEffect(() => {
    if (hasMore && !loadingMore && end >= count - LOAD_AHEAD) onLoadMore();
  }, [end, count, hasMore, loadingMore, onLoadMore]);

  const rows = [];
  for (let i = start; i < end; i++) {
    if (i < sorted.folders.length) {
      const f = sorted.folders[i]!;
      rows.push(
        <DetailsFolderRow
          key={`f:${f.id}`}
          folder={f}
          renaming={renamingId === f.id}
          itemCount={previews.get(f.id)?.itemCount}
          one={words.lowerOne}
          many={words.lowerMany}
        />,
      );
    } else {
      const item = sorted.items[i - sorted.folders.length]!;
      rows.push(
        <DetailsRow
          key={item.id}
          item={item}
          renaming={renamingId === item.id}
          options={options}
        />,
      );
    }
  }

  return (
    <div className={LIST_CARD}>
      <div
        role="row"
        className={`${GRID} border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400`}
      >
        {DETAILS_COLUMNS.map((c) => {
          const on = sort.column === c.id;
          return (
            <span key={c.id} className={CELLS[c.id]}>
              <button
                type="button"
                role="columnheader"
                data-sort-column={c.id}
                aria-sort={on ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                title={`Sort by ${c.label}`}
                onClick={() => sortBy(c.id)}
                className="truncate uppercase hover:text-slate-800 dark:hover:text-slate-200"
              >
                {c.iconOnly ? <span className="sr-only">{c.label}</span> : c.label}
                {c.iconOnly ? <span aria-hidden>{c.label.charAt(0)}</span> : null}
                {on ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            </span>
          );
        })}
        <span aria-hidden />
      </div>
      <ul
        ref={body}
        aria-rowcount={count}
        className={`divide-y divide-slate-100 dark:divide-slate-700/60 ${cascade ? 'lw-cascade' : ''}`}
      >
        {start > 0 ? <li aria-hidden style={{ height: start * ROW_HEIGHT }} /> : null}
        {rows}
        {end < count ? <li aria-hidden style={{ height: (count - end) * ROW_HEIGHT }} /> : null}
      </ul>
      {loadingMore ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
          Loading more…
        </p>
      ) : null}
    </div>
  );
}

const DetailsFolderRow = memo(function DetailsFolderRow({
  folder: f,
  renaming,
  itemCount,
  one,
  many,
}: {
  folder: Folder;
  renaming: boolean;
  itemCount: number | undefined;
  one: string;
  many: string;
}) {
  const bits = useFolderBits(f);
  const menu = useRowMenu({ disabled: renaming });
  const drop = useDropTarget({ teamId: f.teamId, folderId: f.id });
  const drag = useFolderDrag(f, renaming);
  return (
    <li
      data-folder-row={f.id}
      data-drop-over={drop.over || undefined}
      className={`${GRID} group px-4 hover:bg-slate-50 dark:hover:bg-slate-700 ${drop.over ? DROP_ROW : ''}`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={menu.onContextMenu}
      {...drop.handlers}
      {...drag}
    >
      <span className="flex min-w-0 items-center gap-2">
        {/* Where the Type column is hidden, the name carries the folder icon. */}
        <span aria-hidden className="shrink-0 text-amber-500 sm:hidden">
          <FolderSolidIcon />
        </span>
        {renaming ? (
          <InlineRenameInput
            initial={f.name}
            ariaLabel={`Rename ${f.name}`}
            onCommit={bits.commitRename}
            onCancel={bits.cancelRename}
            className={`min-w-0 flex-1 ${RENAME_INPUT}`}
          />
        ) : (
          <button
            type="button"
            onClick={bits.open}
            onDoubleClick={bits.open}
            className="truncate text-left text-sm font-medium text-slate-900 transition hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {f.name}
          </button>
        )}
        {renaming ? null : <DefaultFolderMarker folderId={f.id} />}
      </span>
      <span className={CELLS.type}>
        <FolderTypeCell />
      </span>
      <span className={CELLS.comments} />
      <span className={CELLS.access} />
      <span className={`${CELLS.size} text-xs tabular-nums text-slate-600 dark:text-slate-300`}>
        {itemCount === undefined ? (
          <NoValue label={NOT_COUNTED} />
        ) : (
          <span data-folder-held="">{formatHeld(itemCount, one, many)}</span>
        )}
      </span>
      <span className={CELLS.created}>
        <DateCell at={f.createdAt} />
      </span>
      <span className={CELLS.updated}>
        <DateCell at={f.updatedAt} />
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for folder ${f.name}`} />
      )}
      {menu.open ? (
        <FolderMenu folder={f} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
    </li>
  );
});

const DetailsRow = memo(function DetailsRow({
  item,
  renaming,
  options,
}: {
  item: ShownItem;
  renaming: boolean;
  options: RowOptions;
}) {
  const { Link, renderThumbnail } = useExplorer();
  const { leaving, prefetchThumbnail } = useExtras();
  const bits = useItemBits(item);
  const menu = useRowMenu({ disabled: renaming });
  const drag = useItemDrag(item, renaming);
  const preview = useHoverPreview(Boolean(renderThumbnail) && !renaming && !menu.open);
  const title = item.title || 'Untitled';
  // The snapshot loads ahead as the row comes near the screen (rows mount only then).
  const prefetched = useRef(false);
  useEffect(() => {
    if (prefetched.current || !prefetchThumbnail) return;
    prefetched.current = true;
    prefetchThumbnail(item);
    // Once per row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchThumbnail]);
  const card = preview.spot ? renderThumbnail?.(item, 'card') : null;
  const kind = typeLabel(item, kindWords(item.app).one);
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      preview.handlers.onPointerLeave();
      menu.onContextMenu?.(e);
    },
    [preview.handlers, menu],
  );
  return (
    <li
      data-item-row={item.id}
      className={`${GRID} group px-4 transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
        leaving.has(item.id) ? 'lw-row-out' : ''
      }`}
      style={{ height: ROW_HEIGHT }}
      onContextMenu={onContextMenu}
      {...preview.handlers}
      {...drag}
    >
      <span className="flex min-w-0 items-center gap-2">
        {options.showApp ? <AppMark app={item.app} /> : null}
        {item.favourite ? <FavouriteMarker /> : null}
        {renaming ? (
          <InlineRenameInput
            initial={item.title}
            ariaLabel={`Rename ${title}`}
            onCommit={bits.commitRename}
            onCancel={bits.cancelRename}
            className={`min-w-0 flex-1 ${RENAME_INPUT}`}
          />
        ) : (
          <Link
            href={bits.href}
            className="truncate text-sm font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
          >
            {title}
          </Link>
        )}
        <MadeByAiBadge item={item} />
      </span>
      <span className={CELLS.type}>
        <TypeCell label={kind} />
      </span>
      <span className={CELLS.comments}>
        <CommentsCell count={item.summary.comments} />
      </span>
      <span className={CELLS.access}>
        <AccessCell level={item.access} />
      </span>
      <span className={CELLS.size}>
        <SizeCell item={item} />
      </span>
      <span className={CELLS.created}>
        <DateCell at={item.createdAt} />
      </span>
      <span className={CELLS.updated}>
        <DateCell at={item.updatedAt} />
      </span>
      {renaming ? (
        <span />
      ) : (
        <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${title}`} />
      )}
      {menu.open ? (
        <ItemMenu item={item} anchor={menu.triggerRef.current} onClose={menu.close} />
      ) : null}
      {preview.spot && card ? (
        <HoverPreviewCard spot={preview.spot}>{card}</HoverPreviewCard>
      ) : null}
    </li>
  );
});
