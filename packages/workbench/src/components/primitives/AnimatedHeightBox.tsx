import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// A box that eases its own height toward the measured content height so
// swapping the `viewKey` child doesn't snap the layout taller/shorter. The
// new child also soft-fades in. The height transition is gated on after
// the first measured frame so the box doesn't animate its own mount.
//
// With `maxPx` set it caps the height there and scrolls past it; omit
// `maxPx` to let it grow to the full content height (no inner scroll).
// Uncapped it clips with `overflow-clip`, not `overflow-hidden`: hidden makes
// a scroll box of its own, which would pin a sticky BackBar inside it rather
// than to the scroller around it.
//
// With `settle` set (Tools), a swapped-in view that loads in steps (a skeleton, then its content) never makes the
// box shrink and then grow back: after the swap it only grows, and any shrink waits until nothing in it is loading
// (no `aria-busy="true"`, as every skeleton carries) and it has held still (SETTLE_QUIET_MS), or the window ends
// (SETTLE_MAX_MS), then eases there once.
//
// Shared by the template browser and the Tab Style dialog's home and panels, so drill-ins feel the same.
const ENTER_CLASS = {
  fade: 'animate-fade-in',
  forward: 'animate-view-forward',
  back: 'animate-view-back',
} as const;

// Still for this long once loaded: short, so the box eases down as soon as the content is in.
export const SETTLE_QUIET_MS = 120;
// How often a loading view is looked at again.
export const SETTLE_POLL_MS = 60;
// Shorter than any tool's content: the view has not drawn yet.
export const SETTLE_EMPTY_PX = 80;
export const SETTLE_MAX_MS = 2500;

export function AnimatedHeightBox({
  maxPx,
  viewKey,
  className,
  enter = 'fade',
  settle = false,
  children,
}: {
  maxPx?: number;
  settle?: boolean;
  // How the swapped-in view arrives: a soft fade, or a short slide for a drill-in, `forward` (from the right, going
  // in a level) or `back` (from the left, coming out). Reduced motion turns both slides into the fade.
  enter?: 'fade' | 'forward' | 'back';
  // Identity of the current view. When it changes the inner block
  // remounts (replaying the fade); a stable wrapper around it keeps the
  // ResizeObserver measuring across the swap.
  viewKey: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  // When the view last changed, and the deferred shrink waiting for the content to hold still.
  const swappedAt = useRef(0);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef(settle);
  useLayoutEffect(() => {
    settleRef.current = settle;
  }, [settle]);
  const first = useRef(true);
  // Before the new view is measured.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    swappedAt.current = Date.now();
  }, [viewKey]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setHeight(el.scrollHeight);
    const measure = () => {
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
      shrinkTimer.current = null;
      const next = el.scrollHeight;
      const since = Date.now() - swappedAt.current;
      if (!settleRef.current || since >= SETTLE_MAX_MS) return apply();
      // Inside the window: grow at once, hold a shrink until the content is loaded and still.
      setHeight((h) => (h === null || next > h ? next : h));
      // Loading: a skeleton says so; a view whose code is still arriving draws next to nothing.
      const loading = el.querySelector('[aria-busy="true"]') !== null || next < SETTLE_EMPTY_PX;
      if (since + SETTLE_QUIET_MS < SETTLE_MAX_MS && loading) {
        shrinkTimer.current = setTimeout(measure, SETTLE_POLL_MS);
        return;
      }
      shrinkTimer.current = setTimeout(apply, Math.min(SETTLE_QUIET_MS, SETTLE_MAX_MS - since));
    };
    apply();
    // Absent in older browsers and test DOMs: the box then sizes once and stays natural.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
    };
  }, []);
  const exceedsCap = maxPx !== undefined && height !== null && height > maxPx;
  return (
    <div
      className={`${exceedsCap ? 'overflow-y-auto' : 'overflow-clip'}${
        animate ? ' transition-[height] duration-short ease-out' : ''
      }${className ? ` ${className}` : ''}`}
      style={{
        height:
          height === null ? undefined : maxPx === undefined ? height : Math.min(height, maxPx),
      }}
    >
      {/* Stable (non-keyed) wrapper so the ResizeObserver keeps measuring
          across view swaps; its keyed child remounts + soft-fades while
          the outer height eases to the new size. The `pb-1` keeps the
          bottom row's 2px card border off the clip edge: the box height is
          the integer-rounded scrollHeight, and without the pad sub-pixel
          rounding shaved the last row's border (both pickers hit this). */}
      <div ref={ref} className="pb-1">
        <div key={viewKey} className={ENTER_CLASS[enter]}>
          {children}
        </div>
      </div>
    </div>
  );
}
