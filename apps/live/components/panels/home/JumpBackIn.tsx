'use client';

// Jump back in (docs/specs/013-workspace/explorer-home.md "Jump back in"): the documents the person
// returns to most, as one sideways-scrolling strip of small snapshot thumbnails. Its trailing edge
// fades while more lies to the right; the fade is an overlay, so nothing moves when it comes or
// goes. A document stored only in this browser wears the Local only pill on its thumbnail.

import { useEffect, useRef, useState } from 'react';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { LocalOnlyPill, LOCAL_ONLY_LABEL } from '@/components/primitives/LocalOnlyPill';
import { track } from '@/lib/telemetry';
import { Tooltip } from '@livediagram/ui';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { stripFade, type JumpBackInItem } from '@/app/explorer/home/home-model';
import { StripSkeleton } from './HomeSkeletons';
import { FOCUS_RING, SUB_HEADING } from './home-styles';

const THUMB =
  'h-20 w-32 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

export function JumpBackIn({
  ownerId,
  items,
  loading,
}: {
  ownerId: string;
  items: JumpBackInItem[];
  loading: boolean;
}) {
  return (
    <div>
      <h3 id="home-jump-back-in" className={`mb-2 ${SUB_HEADING}`}>
        {HOME_COPY.jumpBackIn}
      </h3>
      {loading ? (
        <StripSkeleton />
      ) : items.length === 0 ? (
        <p className="flex h-28 items-center text-sm text-slate-500 dark:text-slate-400">
          {HOME_COPY.jumpBackInEmpty}
        </p>
      ) : (
        <Strip ownerId={ownerId} items={items} />
      )}
    </div>
  );
}

function Strip({ ownerId, items }: { ownerId: string; items: JumpBackInItem[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [fade, setFade] = useState(false);

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
  }, [items]);

  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-labelledby="home-jump-back-in"
        className="scrollbar-slim -mx-1 flex h-28 snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1"
      >
        {items.map((item) => (
          <li key={item.documentId} className="w-32 shrink-0 snap-start">
            <Tooltip label={item.name}>
              <a
                href={item.href}
                aria-label={item.localOnly ? `${item.name}, ${LOCAL_ONLY_LABEL}` : item.name}
                onClick={() => track('Home', 'Selected', 'JumpBackIn')}
                className={`group block rounded-md ${FOCUS_RING}`}
              >
                <span className="relative block">
                  <DocumentThumbnail
                    ownerId={ownerId}
                    documentId={item.documentId}
                    version={item.savedAt}
                    shareCode={item.shareCode}
                    offline={item.localOnly}
                    empty={item.empty}
                    className={`${THUMB} transition group-hover:border-slate-300 dark:group-hover:border-slate-500`}
                  />
                  {item.localOnly ? (
                    <span className="absolute bottom-1 left-1">
                      <LocalOnlyPill asLabel />
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block w-32 truncate text-xs text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">
                  {item.name}
                </span>
              </a>
            </Tooltip>
          </li>
        ))}
      </ul>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent motion-safe:transition-opacity dark:from-slate-900 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
