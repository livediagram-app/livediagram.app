'use client';

// One layout in the gallery (docs/specs/007-editor/pages-mode.md "The layout gallery"): its
// rendered preview, lifted and ringed under the pointer with a "Use" pill, its name and (where the
// gallery has room) its one-line description. The preview is drawn once the tile scrolls near
// view, a soft placeholder of the page's shape until then, so a gallery of ninety layouts opens
// without drawing them all.
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import type { LaidOutPage } from '@livedesign/design';
import type { PageLayoutId } from '@livedesign/templates';
import { LayoutThumb } from '../layout-thumb';
import type { GalleryLayout } from './layout-gallery-filter';

// How far beyond the scrolling area a tile starts drawing, so a flick rarely meets a placeholder.
const DRAW_AHEAD_PX = 320;
// The tallest a wireframe page's tile stands: a phone, twice as tall as wide, narrows to fit
// (LayoutThumb's maxHeight) rather than towering over the row.
const WIREFRAME_TILE_MAX_H = 200;

/** Whether the element has come within DRAW_AHEAD_PX of the scrolling area; true at once where
 *  there is no IntersectionObserver (a test), and for good once seen. */
function useSeen(el: RefObject<HTMLElement | null>, root: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !el.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { root: root.current, rootMargin: `${DRAW_AHEAD_PX}px` },
    );
    io.observe(el.current);
    return () => io.disconnect();
  }, [seen, el, root]);
  return seen;
}

export const LayoutTile = memo(function LayoutTile({
  layout,
  page,
  width,
  described,
  scrollRoot,
  onPick,
  onPreview,
}: {
  layout: GalleryLayout;
  page: LaidOutPage;
  // The preview's width in px.
  width: number;
  // Shows the one-line description under the name (a gallery with room for it).
  described: boolean;
  scrollRoot: RefObject<HTMLElement | null>;
  onPick: (id: PageLayoutId) => void;
  onPreview: (id: PageLayoutId | null) => void;
}) {
  const art = useRef<HTMLDivElement>(null);
  const seen = useSeen(art, scrollRoot);
  const tall = Math.round((width * page.rect.height) / page.rect.width);
  const height = page.kind === 'wireframe' ? Math.min(tall, WIREFRAME_TILE_MAX_H) : tall;
  return (
    <button
      type="button"
      data-layout-tile={layout.id}
      aria-label={`${layout.label}: ${layout.description}`}
      onClick={() => onPick(layout.id)}
      onPointerEnter={() => onPreview(layout.id)}
      onFocus={() => onPreview(layout.id)}
      className="group flex min-w-0 flex-col items-stretch rounded-xl p-1.5 text-left transition-colors duration-micro hover:bg-slate-100/80 focus-visible:outline-2 focus-visible:outline-brand-600 active:scale-[0.98] dark:hover:bg-slate-800/70"
    >
      <div
        ref={art}
        className="relative overflow-hidden rounded-lg bg-slate-100 shadow-sm ring-1 ring-slate-900/10 transition duration-micro ease-out group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-brand-900/10 group-hover:ring-2 group-hover:ring-brand-500 group-focus-visible:ring-2 group-focus-visible:ring-brand-500 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 dark:bg-slate-800 dark:ring-white/10"
        style={{ width, height }}
      >
        {seen ? (
          <span className="flex h-full w-full items-center justify-center">
            <LayoutThumb layout={layout.id} page={page} width={width} maxHeight={height} />
          </span>
        ) : null}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-1.5 translate-y-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-brand-600 opacity-0 shadow-sm transition duration-micro group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          Use
        </span>
      </div>
      <span className="mt-1.5 truncate px-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
        {layout.label}
      </span>
      {described ? (
        <span className="line-clamp-2 px-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {layout.description}
        </span>
      ) : null}
    </button>
  );
});
