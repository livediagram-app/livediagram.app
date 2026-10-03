'use client';

// Jump back in on a phone (docs/specs/013-workspace/explorer-home.md "Phone"): one sideways strip of
// at most 8 thumbnails, most used and recent alternating, ending in the See more tile. Its trailing
// edge fades while more lies to the right; the fade is an overlay, so nothing moves when it comes or
// goes.

import { useEffect, useRef, useState } from 'react';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { phoneOrder, stripFade, type JumpBackInSet } from '@/app/explorer/home/home-model';
import { JumpBackInTile, SeeMoreTile } from './JumpBackInTile';
import { MUTED, STRIP_HEIGHT, STRIP_THUMB, STRIP_TILE } from './home-styles';

export function JumpBackInStrip({
  ownerId,
  set,
  recentHref,
  onSeeMore,
  labelledBy,
}: {
  ownerId: string;
  set: JumpBackInSet;
  recentHref: string;
  onSeeMore: () => void;
  labelledBy: string;
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
    <div className="relative">
      <div
        ref={ref}
        className={`scrollbar-slim -mx-1 flex ${STRIP_HEIGHT} snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1`}
      >
        {tiles.length === 0 ? (
          <p className={`flex w-48 shrink-0 items-center text-sm ${MUTED}`}>
            {HOME_COPY.jumpBackInEmpty}
          </p>
        ) : (
          <ul aria-labelledby={labelledBy} className="flex shrink-0 gap-3">
            {tiles.map(({ item, group }) => (
              <li key={item.documentId} className={`${STRIP_TILE} snap-start`}>
                <JumpBackInTile
                  ownerId={ownerId}
                  item={item}
                  group={group}
                  thumbClassName={STRIP_THUMB}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="snap-start">
          <SeeMoreTile href={recentHref} onSeeMore={onSeeMore} />
        </div>
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
