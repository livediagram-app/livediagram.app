'use client';

// One layout in a product's layout gallery (docs/specs/007-editor/pages-mode.md "The layout
// gallery", in livedesign and livedocuments): its rendered preview, its name and (where the gallery
// has room) its one-line description. The product draws the preview (`thumb`); this card owns the
// states every product shares:
// - hover (a mouse or pen only: Tailwind's hover variants sit behind `(hover: hover)`, so a touch
//   screen never keeps one) and keyboard focus alike: a faint brand wash behind the tile, the
//   preview lifting 2 px over a soft shadow, a thin brand-tinted edge, a brand glow rising from its
//   foot and a Use pill sliding up;
// - pressed: the preview settles back and shrinks a touch;
// - placed (`current`): a brand backing, a 2 px brand edge and a Placed badge in place of Use.
// The shadow, edge and glow are layers drawn once and faded by opacity, and the lift is a
// transform, so pointing across a grid of ninety tiles animates no box-shadow and no filter.
// The preview is drawn once the tile scrolls near view, a soft placeholder of the page's shape
// until then, so a long catalogue opens without drawing it all.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { lucideGlyph, SOLID_BRAND_DARK } from '@liveworkspace/ui';

// How far beyond the scrolling area a tile starts drawing, so a flick rarely meets a placeholder.
export const DRAW_AHEAD_PX = 320;

const TickIcon = lucideGlyph(lucideCheck, 10);

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

// The motion every moving layer shares: short, eased, and none under reduced motion.
const EASE = 'duration-micro ease-out motion-reduce:transition-none';
// Shown on hover and on keyboard focus alike (each layer fades in with the same pair).
const ON_POINT = 'group-hover:opacity-100 group-focus-visible:opacity-100';

// The whole tile: its backing warms on hover, and keyboard focus rings it, offset, round the lot.
const TILE =
  'group flex min-w-0 scroll-mt-8 cursor-pointer flex-col items-stretch rounded-xl p-1.5 text-left transition-colors duration-micro ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:focus-visible:outline-brand-400';
const TILE_REST =
  'hover:bg-brand-50/60 focus-visible:bg-brand-50/60 dark:hover:bg-brand-500/[0.07] dark:focus-visible:bg-brand-500/[0.07]';
const TILE_PLACED = 'bg-brand-50 dark:bg-brand-500/[0.12]';

// The lift: up 2 px under the pointer or focus, back down and a touch smaller while pressed.
const LIFT = `relative block rounded-lg transition-[translate,scale] ${EASE} group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 group-active:translate-y-0 group-active:scale-[0.98] motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-visible:translate-y-0 motion-reduce:group-active:scale-100`;
// The raised shadow under the lifted preview, drawn once and faded in.
const HALO = `pointer-events-none absolute inset-0 rounded-lg opacity-0 shadow-[0_12px_24px_-12px_rgb(15_23_42/0.35),0_4px_10px_-6px_rgb(15_23_42/0.18)] transition-opacity ${EASE} ${ON_POINT} group-active:opacity-60 dark:shadow-[0_12px_24px_-10px_rgb(0_0_0/0.7),0_4px_10px_-6px_rgb(0_0_0/0.5)]`;
// The preview's frame: a soft surface with a hairline edge and a faint resting shadow.
const FRAME =
  'relative block overflow-hidden rounded-lg bg-slate-100 shadow-sm ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10';
// The brand-tinted edge laid over the hairline: thin while pointed at, 2 px once placed.
const EDGE_REST = `pointer-events-none absolute inset-0 rounded-lg opacity-0 ring-1 ring-inset ring-brand-500/45 transition-opacity ${EASE} ${ON_POINT} dark:ring-brand-300/50`;
const EDGE_PLACED =
  'pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-brand-600 dark:ring-brand-400';
// A faint brand glow rising from the preview's foot, under the pill.
const GLOW = `pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-brand-500/[0.14] to-transparent opacity-0 transition-opacity ${EASE} ${ON_POINT} dark:from-brand-400/[0.16]`;
// Use: slides up into the preview's corner as the tile is pointed at.
const USE_PILL = `pointer-events-none absolute bottom-1.5 right-1.5 translate-y-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-[opacity,translate] ${EASE} group-hover:translate-y-0 group-focus-visible:translate-y-0 ${ON_POINT} ${SOLID_BRAND_DARK}`;
// Placed: a steady badge with a tick, where Use would rise.
const PLACED_BADGE = `pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-brand-700 py-0.5 pl-1.5 pr-2 text-[10px] font-semibold text-white shadow-sm ${SOLID_BRAND_DARK}`;

export type LayoutCardProps<Id extends string> = {
  id: Id;
  label: string;
  description: string;
  // The preview's size in px.
  width: number;
  height: number;
  // Shows the one-line description under the name (a gallery with room for it).
  described: boolean;
  // The layout last placed from this gallery: marked Placed, and scrolled into view.
  current?: boolean;
  scrollRoot: RefObject<HTMLElement | null>;
  // The layout's preview, drawn once the tile comes near view.
  thumb: () => ReactNode;
  onPick: (id: Id) => void;
  onPreview: (id: Id | null) => void;
};

/** One layout's tile; the product's own tile memoises it and draws its preview. */
export function LayoutCard<Id extends string>({
  id,
  label,
  description,
  width,
  height,
  described,
  current = false,
  scrollRoot,
  thumb,
  onPick,
  onPreview,
}: LayoutCardProps<Id>) {
  const art = useRef<HTMLSpanElement>(null);
  const tile = useRef<HTMLButtonElement>(null);
  const seen = useSeen(art, scrollRoot);
  // A layout newly placed while the gallery stays open (Surprise Me) is brought into view, so the
  // roll can be seen in the grid as well as on the page.
  useEffect(() => {
    if (current) tile.current?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);
  return (
    <button
      ref={tile}
      type="button"
      data-layout-tile={id}
      data-placed={current ? '' : undefined}
      aria-current={current ? 'true' : undefined}
      aria-label={`${label}: ${description}`}
      onClick={() => onPick(id)}
      onPointerEnter={() => onPreview(id)}
      onFocus={() => onPreview(id)}
      className={`${TILE} ${current ? TILE_PLACED : TILE_REST}`}
    >
      <span className={LIFT}>
        <span aria-hidden className={HALO} />
        <span ref={art} className={FRAME} style={{ width, height }}>
          {seen ? (
            <span className="flex h-full w-full items-center justify-center">{thumb()}</span>
          ) : null}
          <span aria-hidden className={GLOW} />
          <span aria-hidden className={current ? EDGE_PLACED : EDGE_REST} />
          {current ? (
            <span aria-hidden className={PLACED_BADGE}>
              <TickIcon />
              Placed
            </span>
          ) : (
            <span aria-hidden className={USE_PILL}>
              Use
            </span>
          )}
        </span>
      </span>
      <span className="mt-1.5 truncate px-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </span>
      {described ? (
        <span className="line-clamp-2 px-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </span>
      ) : null}
    </button>
  );
}
