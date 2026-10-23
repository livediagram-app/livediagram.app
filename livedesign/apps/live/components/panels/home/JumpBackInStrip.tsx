'use client';

// Jump Back In on a phone (docs/specs/013-workspace/explorer-home.md "Phone"): one sideways strip of
// at most 8 thumbnails, most used and recent alternating, ending in the See More tile. Its trailing
// edge fades while more lies to the right; the fade is an overlay, so nothing moves when it comes or
// goes.

import { useEffect, useRef, useState } from 'react';
import { CompactEmptyState } from '@livedesign/ui';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { phoneOrder, stripFade, type JumpBackInSet } from '@/app/explorer/home/home-model';
import type { JumpBackInMenuFor } from './JumpBackInMenu';
import { JumpBackInTile, SeeMoreTile } from './JumpBackInTile';
import { JumpBackInEmptyIcon } from './home-icons';
import { STRIP_HEIGHT, STRIP_THUMB, STRIP_TILE } from './home-styles';

export function JumpBackInStrip({
  ownerId,
  set,
  recentHref,
  onSeeMore,
  labelledBy,
  menuFor,
}: {
  ownerId: string;
  set: JumpBackInSet;
  recentHref: string;
  onSeeMore: () => void;
  labelledBy: string;
  /** Each design's Explorer menu (explorer-home.md "Jump Back In"); omitted, no tile has one. */
  menuFor?: JumpBackInMenuFor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  const tiles = phoneOrder(set);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFade(stripFade(el));
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
    };
  }, [tiles.length]);

  return (
    // On a phone the strip runs to the screen's edges (the page's 16 px padding given back), so a card scrolls out
    // at the edge under the fade rather than being cut off short of it.
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={ref}
        className={`scrollbar-slim flex ${STRIP_HEIGHT} scroll-px-4 snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-1 sm:scroll-px-1 sm:px-1`}
      >
        {tiles.length === 0 ? (
          // The heading alone: the strip's height holds no second line. With nothing to show, no See More either.
          <CompactEmptyState
            size="small"
            className="w-48 shrink-0"
            icon={<JumpBackInEmptyIcon />}
            title={HOME_COPY.jumpBackInEmptyTitle}
          />
        ) : (
          <ul aria-labelledby={labelledBy} className="flex shrink-0 gap-3">
            {tiles.map(({ item, group }) => (
              <li key={item.designId} className={`${STRIP_TILE} snap-start`}>
                <JumpBackInTile
                  ownerId={ownerId}
                  item={item}
                  group={group}
                  thumbClassName={STRIP_THUMB}
                  entry={menuFor?.(item.designId) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
        {tiles.length > 0 ? (
          <div className="snap-start">
            <SeeMoreTile href={recentHref} onSeeMore={onSeeMore} />
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent motion-safe:transition-opacity dark:from-slate-900 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
