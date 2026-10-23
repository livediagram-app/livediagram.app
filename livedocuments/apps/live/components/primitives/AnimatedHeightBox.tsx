import { useEffect, useRef, useState, type ReactNode } from 'react';

// A box that eases its own height toward the measured content height so
// swapping the `viewKey` child doesn't snap the layout taller/shorter. The
// new child also soft-fades in. The height transition is gated on after
// the first measured frame so the box doesn't animate its own mount.
//
// It grows to the full content height (no inner scroll), and clips with `overflow-clip`, not `overflow-hidden`: hidden makes
// a scroll box of its own, which would pin a sticky BackBar inside it rather
// than to the scroller around it.
//
// Shared by the template browser and the Tab Style dialog's home and panels, so drill-ins feel the same.
const ENTER_CLASS = {
  fade: 'animate-fade-in',
  forward: 'animate-view-forward',
  back: 'animate-view-back',
} as const;

export function AnimatedHeightBox({
  viewKey,
  className,
  enter = 'fade',
  children,
}: {
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
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div
      className={`overflow-clip${
        animate ? ' transition-[height] duration-short ease-out' : ''
      }${className ? ` ${className}` : ''}`}
      style={{ height: height ?? undefined }}
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
