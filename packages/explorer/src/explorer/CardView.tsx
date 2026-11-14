'use client';

// The card layout (liveplanner's CardView): folders then items as a grid of cards with a large preview.
// Cards are revealed a batch at a time as the end of the grid scrolls into view, and the next page of the
// list loads once every loaded card is shown. Of the revealed item cards only the rows on screen (and a few
// either side) are in the DOM (useCardWindow), so a 2,000-item list scrolled to its end holds a screenful of
// previews, not 2,000.

import { useCascade } from '../ui/useCascade';
import { rowKeys, useFocusAfterRemoval } from '../ui/useFocusAfterRemoval';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { Button } from '@liveworkspace/ui';
import { CARD_GRID } from '../ui/classes';
import { useExplorer } from './context';
import { FolderCard, ItemCard, type RowOptions } from './rows';
import { useCardWindow } from './useCardWindow';
import { revealAt, useRevealArrived } from './arrived-item';

export const CARD_BATCH = 60;

export function CardView({
  folders,
  items,
  options,
  hasMore,
  loadingMore,
  onLoadMore,
  resetKey,
}: {
  folders: Folder[];
  items: ShownItem[];
  options: RowOptions;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  // A new list starts again from the first batch.
  resetKey: string;
}) {
  const { renamingId, client, app, filter, epoch, placedEpoch } = useExplorer();
  const cascade = useCascade(resetKey);
  const [shown, setShown] = useState({ key: resetKey, count: CARD_BATCH });
  const limit = shown.key === resetKey ? shown.count : CARD_BATCH;
  const count = folders.length + items.length;
  const sentinel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  useFocusAfterRemoval(
    grid,
    useMemo(() => rowKeys(folders, items), [folders, items]),
  );
  const more = count > limit || hasMore;

  const showMore = () => {
    if (count > limit) setShown({ key: resetKey, count: limit + CARD_BATCH });
    else if (hasMore && !loadingMore) onLoadMore();
  };
  const showMoreRef = useRef(showMore);
  showMoreRef.current = showMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) showMoreRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit, count]);

  const end = Math.min(count, limit);
  // The folder cards on screen, asked about together: one request for what is inside them all.
  const shownFolderIds = useMemo(
    () => folders.slice(0, Math.min(folders.length, end)).map((f) => f.id),
    [folders, end],
  );
  const previews = useFolderPreviews({
    client,
    folderIds: shownFolderIds,
    app: filter === 'all' ? null : app,
    epoch,
    placedEpoch,
  });

  // The folders draw whole; the item cards revealed so far are windowed to the rows on screen.
  const shownFolders = Math.min(folders.length, end);
  const shownItems = end - shownFolders;
  const spacerAbove = useRef<HTMLDivElement>(null);
  const runFirstId = useRef<string | null>(null);
  // Where the run of item-only rows starts as drawn: the spacer above it, else its first card.
  const runStartOf = () => {
    if (spacerAbove.current) return spacerAbove.current;
    const id = runFirstId.current;
    return id
      ? (grid.current?.querySelector<HTMLElement>(`[data-item-card="${CSS.escape(id)}"]`) ?? null)
      : null;
  };
  const win = useCardWindow(grid, shownFolders, shownItems, runStartOf);
  runFirstId.current = win.start < win.end ? items[win.start]!.id : null;
  // The item an editor's door came from: loaded, revealed past the batches shown and brought into the card window, so
  // it is drawn and marked.
  useRevealArrived({
    items,
    offset: 0,
    hasMore,
    loadingMore,
    onLoadMore,
    reveal: (at) => {
      // Past the cards revealed so far: reveal through its batch; the next render tries again.
      if (folders.length + at >= limit) {
        setShown({
          key: resetKey,
          count: Math.ceil((folders.length + at + 1) / CARD_BATCH) * CARD_BATCH,
        });
        return true;
      }
      // Until the window has measured the grid there is no row to scroll to: the render after it measures tries
      // again. A card on the last folder row always draws.
      if (win.cols < 1 || at < win.shared) return false;
      const run = runStartOf();
      if (!grid.current || !run) return false;
      const row = Math.floor((at - win.shared) / win.cols);
      revealAt(grid.current, run.offsetTop + row * win.pitch, win.pitch - win.gap);
      return true;
    },
  });
  const cards = [];
  for (let i = 0; i < shownFolders; i++) {
    const f = folders[i]!;
    cards.push(
      <FolderCard
        key={`f:${f.id}`}
        folder={f}
        renaming={renamingId === f.id}
        preview={previews.get(f.id)}
      />,
    );
  }
  const itemCard = (i: number) => {
    const item = items[i]!;
    return (
      <ItemCard key={item.id} item={item} renaming={renamingId === item.id} options={options} />
    );
  };
  const spacer = (rows: number, key: string, ref?: typeof spacerAbove) => (
    <div
      key={key}
      ref={ref}
      aria-hidden
      data-card-spacer
      className="col-span-full"
      style={{ height: rows * win.pitch - win.gap }}
    />
  );
  for (let i = 0; i < win.shared; i++) cards.push(itemCard(i));
  if (win.rowsBefore > 0) cards.push(spacer(win.rowsBefore, 'before', spacerAbove));
  for (let i = win.start; i < win.end; i++) cards.push(itemCard(i));
  if (win.rowsAfter > 0) cards.push(spacer(win.rowsAfter, 'after'));

  return (
    <>
      <div ref={grid} className={`relative ${CARD_GRID} ${cascade ? 'lw-cascade' : ''}`}>
        {cards}
      </div>
      {more ? (
        <div ref={sentinel} className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={showMore} busy={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
