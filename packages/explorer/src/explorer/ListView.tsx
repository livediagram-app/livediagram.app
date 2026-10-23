'use client';

// The list layout (liveplanner's ListView): a header band over folder rows then item rows. Long lists are
// windowed: every row is ROW_HEIGHT tall, only the rows on screen (and OVERSCAN either side) are in the
// DOM, spacers keep the scroll height, and the next page loads as the end comes near.

import { useEffect, useMemo, useRef } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { LIST_CARD, LIST_HEADER } from '../ui/classes';
import { useExplorer } from './context';
import { FolderRow, ItemRow, ROW_GRID, ROW_HEIGHT, type RowOptions } from './rows';
import { useWindowedRange } from './useWindow';

// Ask for the next page this many rows before the end.
const LOAD_AHEAD = 40;

export function ListView({
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
  const { renamingId, client, app, filter, epoch, placedEpoch } = useExplorer();
  const body = useRef<HTMLUListElement>(null);
  const count = folders.length + items.length;
  const range = useWindowedRange(body, count, ROW_HEIGHT);
  // The range trails a shrinking list by one render (an item trashed): clamp it to what is there.
  const end = Math.min(range.end, count);
  const start = Math.min(range.start, end);

  useEffect(() => {
    if (hasMore && !loadingMore && end >= count - LOAD_AHEAD) onLoadMore();
  }, [end, count, hasMore, loadingMore, onLoadMore]);

  // The folder rows on screen, asked about together (one request per batch, only for rows not yet answered), so
  // each counts its items as well as its subfolders.
  const shownFolderIds = useMemo(
    () =>
      folders
        .slice(Math.min(start, folders.length), Math.min(end, folders.length))
        .map((f) => f.id),
    [folders, start, end],
  );
  const previews = useFolderPreviews({
    client,
    folderIds: shownFolderIds,
    app: filter === 'all' ? null : app,
    epoch,
    placedEpoch,
  });

  const rows = [];
  for (let i = start; i < end; i++) {
    if (i < folders.length) {
      const f = folders[i]!;
      rows.push(
        <FolderRow
          key={`f:${f.id}`}
          folder={f}
          renaming={renamingId === f.id}
          itemCount={previews.get(f.id)?.itemCount}
        />,
      );
    } else {
      const item = items[i - folders.length]!;
      rows.push(
        <ItemRow key={item.id} item={item} renaming={renamingId === item.id} options={options} />,
      );
    }
  }

  return (
    <div className={LIST_CARD}>
      <div className={`${ROW_GRID} ${LIST_HEADER}`}>
        <span>Name</span>
        <span className="hidden sm:block">Visibility</span>
        <span>Updated</span>
        <span aria-hidden />
      </div>
      <ul
        ref={body}
        aria-rowcount={count}
        className="divide-y divide-slate-100 dark:divide-slate-700/60"
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
