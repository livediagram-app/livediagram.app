'use client';

// The card layout (liveplanner's CardView): folders then items as a grid of cards with a large preview.
// Cards are revealed a batch at a time as the end of the grid scrolls into view, and the next page of the
// list loads once every loaded card is shown, so a 2,000-item list never mounts 2,000 previews at once.

import { useCascade } from '../ui/useCascade';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { useFolderPreviews } from '../data/useFolderPreviews';
import { Button } from '../ui/Button';
import { CARD_GRID } from '../ui/classes';
import { useExplorer } from './context';
import { FolderCard, ItemCard, type RowOptions } from './rows';

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

  const cards = [];
  for (let i = 0; i < end; i++) {
    if (i < folders.length) {
      const f = folders[i]!;
      cards.push(
        <FolderCard
          key={`f:${f.id}`}
          folder={f}
          renaming={renamingId === f.id}
          preview={previews.get(f.id)}
        />,
      );
    } else {
      const item = items[i - folders.length]!;
      cards.push(
        <ItemCard key={item.id} item={item} renaming={renamingId === item.id} options={options} />,
      );
    }
  }

  return (
    <>
      <div className={`${CARD_GRID} ${cascade ? 'lw-cascade' : ''}`}>{cards}</div>
      {more ? (
        <div ref={sentinel} className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={showMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
