'use client';

import { isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// The moving part of the Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): the tiles of the
// current category plus its More button. Switching category can take the
// strip from three tiles to ten, so rather than snapping to the new size:
//
// - the rail's WIDTH eases to the new content's measured width (the strip is
//   centred, so it grows and shrinks from both sides evenly);
// - the new tiles pop in one after another, a short beat apart;
// - the outgoing tiles fade and shrink away on a layer laid over the top,
//   so they leave from where they were instead of vanishing.
//
// Within a category the tiles can also REORDER (a used tile moves to the
// front, docs/specs/007-editor/toolbar-layout.md). Each tile is keyed by its own React key, so a tile that
// moves keeps its node: it slides from its old slot to its new one (FLIP), a
// tile new to the strip pops in, and one pushed off the end shrinks away where
// it stood. Other re-renders (a tile lighting up while its draw is armed)
// animate nothing. Reduced motion collapses all of
// it to instant through the global rules in globals.css.

// Beat between two incoming tiles. Shorter than the 40ms default of
// `.stagger-enter`: ten tiles at 40ms is nearly half a second of arriving.
const STAGGER_STEP = '22ms';

// How long the outgoing layer stays mounted: its pop-out, shortened.
export const RAIL_LEAVE_MS = 160;
// How long a reordered tile takes to slide to its new slot.
const REORDER_MS = 200;

// An item's identity within the rail: its React key, or its index for an
// unkeyed item (which then simply doesn't take part in a reorder).
const itemKey = (item: ReactNode, i: number): string =>
  isValidElement(item) && item.key !== null ? String(item.key) : `#${i}`;

type Dropped = { key: string; node: ReactNode; left: number };

export function ToolbarStripRail({
  railKey,
  items,
  leavingItems,
}: {
  // Identity of what is showing (the category id). A change is what animates.
  railKey: string;
  items: ReactNode[];
  // The previous category's items, while they are on their way out. The host
  // clears this after RAIL_LEAVE_MS.
  leavingItems: ReactNode[] | null;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Off for the first measured frame, so the strip doesn't animate itself
  // open on page load (the same gate PaletteTabBar uses for its height).
  const [animate, setAnimate] = useState(false);
  // Tiles pop in only once the category has CHANGED: the first set is just
  // there, like the rest of the chrome. Derived during render (React's
  // "adjusting state when a prop changes" pattern), not in an effect.
  const [seenKey, setSeenKey] = useState(railKey);
  const [switched, setSwitched] = useState(false);
  if (railKey !== seenKey) {
    setSeenKey(railKey);
    setSwitched(true);
  }

  // Where each tile sat after the last render (offsetLeft, which ignores the
  // transforms a slide applies), and the node it rendered, so a reorder can
  // slide the ones that moved and show the one that fell off leaving.
  const slots = useRef(new Map<string, { left: number; node: ReactNode }>());
  const seenOrder = useRef<string | null>(null);
  const [dropped, setDropped] = useState<Dropped[]>([]);
  const [entering, setEntering] = useState<ReadonlySet<string>>(new Set());
  const keys = items.map(itemKey);
  const order = `${railKey}|${keys.join(',')}`;

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const prev = slots.current;
    const reordered =
      seenOrder.current !== null &&
      seenOrder.current !== order &&
      seenOrder.current.startsWith(`${railKey}|`);
    seenOrder.current = order;
    const next = new Map<string, { left: number; node: ReactNode }>();
    const moved: HTMLElement[] = [];
    const arrived = new Set<string>();
    el.querySelectorAll<HTMLElement>(':scope > [data-rail-key]').forEach((node, i) => {
      const key = node.dataset.railKey!;
      next.set(key, { left: node.offsetLeft, node: items[i] });
      if (!reordered) return;
      const was = prev.get(key);
      if (!was) {
        arrived.add(key);
        return;
      }
      const dx = was.left - node.offsetLeft;
      if (dx === 0) return;
      // Invert: back where it was, with no transition...
      node.style.transition = 'none';
      node.style.transform = `translateX(${dx}px)`;
      moved.push(node);
    });
    slots.current = next;
    if (!reordered) return;
    setEntering(arrived);
    setDropped([...prev].filter(([key]) => !next.has(key)).map(([key, v]) => ({ key, ...v })));
    // ...then play: let it ease to its real slot.
    void el.offsetWidth;
    for (const node of moved) {
      node.style.transition = `transform ${REORDER_MS}ms ease-out`;
      node.style.transform = '';
    }
    const done = window.setTimeout(
      () => {
        for (const node of moved) node.style.transition = '';
        setDropped([]);
        setEntering(new Set());
      },
      Math.max(REORDER_MS, RAIL_LEAVE_MS),
    );
    return () => window.clearTimeout(done);
    // `items` is read for the dropped nodes only; `order` is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, railKey]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [railKey]);

  return (
    <div
      // Clipped sideways only, so a shrinking rail hides the outgoing tiles
      // past its edge while pressed rings and the pop's overshoot still show.
      className={`relative flex items-center overflow-x-clip [overflow-clip-margin:3px]${
        animate ? ' transition-[width] duration-200 ease-out' : ''
      }`}
      style={{ width: width ?? undefined }}
    >
      <div key={railKey} ref={contentRef} className="flex w-max items-center gap-0.5">
        {items.map((item, i) => (
          <span
            // Keyed by the item, so a tile that moves within a category
            // keeps its node and can slide (the whole set is still replaced
            // on a category change: the parent div is keyed).
            key={keys[i]}
            data-rail-key={keys[i]}
            className={`flex ${
              switched
                ? 'stagger-enter animate-pop-in'
                : entering.has(keys[i]!)
                  ? 'animate-pop-in'
                  : ''
            }`}
            style={{ '--stagger-i': i, '--stagger-step': STAGGER_STEP } as React.CSSProperties}
          >
            {item}
          </span>
        ))}
      </div>
      {dropped.length > 0 ? (
        // A tile pushed off the end by a reorder, shrinking away in the slot
        // it held while its neighbour slides in over it.
        <div aria-hidden inert className="pointer-events-none absolute inset-0">
          {dropped.map((d) => (
            <span
              key={d.key}
              className="absolute top-0 flex h-full animate-pop-out items-center"
              style={{ left: d.left, animationDuration: `${RAIL_LEAVE_MS}ms` }}
            >
              {d.node}
            </span>
          ))}
        </div>
      ) : null}
      {leavingItems ? (
        // Laid over the incoming set, inert, and gone in RAIL_LEAVE_MS.
        <div
          aria-hidden
          inert
          className="pointer-events-none absolute left-0 top-0 flex h-full w-max items-center gap-0.5"
        >
          {leavingItems.map((item, i) => (
            <span
              key={i}
              className="flex animate-pop-out"
              style={{ animationDuration: `${RAIL_LEAVE_MS}ms` }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
