import { useEffect, useRef, useState, type ReactNode } from 'react';

// A box that eases its own height toward the measured content height so
// swapping the `viewKey` child doesn't snap the layout taller/shorter. The
// new child also soft-fades in. The height transition is gated on after
// the first measured frame so the box doesn't animate its own mount.
//
// With `maxPx` set it caps the height there and scrolls past it; omit
// `maxPx` to let it grow to the full content height (no inner scroll).
//
// Shared by the template + theme browsers in TemplatePicker so the two
// two-level pickers can't drift in feel.
export function AnimatedHeightBox({
  maxPx,
  viewKey,
  className,
  children,
}: {
  maxPx?: number;
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
  const exceedsCap = maxPx !== undefined && height !== null && height > maxPx;
  return (
    <div
      className={`${exceedsCap ? 'overflow-y-auto' : 'overflow-hidden'}${
        animate ? ' transition-[height] duration-200 ease-out' : ''
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
        <div key={viewKey} className="animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
