'use client';

// A row of filter chips (a team's Library tab, the Image Gallery): one pill each, the one on drawn solid, an optional
// logo before the label and a count after it, in one row that scrolls sideways rather than wrapping, its edges fading
// while there is more past them.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

const CHIP =
  'relative touch-target-y inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const CHIP_ON =
  'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
const CHIP_OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className'> & {
  on: boolean;
  label: ReactNode;
  /** Before the label (an app's logo), hidden from a screen reader: the label names it. */
  logo?: ReactNode;
  /** After the label, quiet; left out while it isn't known. */
  count?: number | null;
};

export function FilterChip({ on, label, logo, count, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF} ${logo ? 'pl-2' : ''}`}
    >
      {logo ? (
        <span aria-hidden className="inline-flex">
          {logo}
        </span>
      ) : null}
      {label}
      {typeof count === 'number' ? <Count n={count} on={on} /> : null}
    </button>
  );
}

/** The chips' row: a group named `label`, scrolling sideways with its edges faded. `size` re-measures the fade when
 *  the number of chips changes. */
export function FilterChipRow({
  label,
  size,
  children,
  className = '',
  ...data
}: {
  label: string;
  size: number;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string>) {
  const { ref, fade } = useEdgeFade(size);
  return (
    <div
      ref={ref}
      style={fade}
      role="group"
      aria-label={label}
      {...data}
      className={`-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] ${className}`}
    >
      {children}
    </div>
  );
}

// An edge fades while there is more past it, so a chip that doesn't fit reads as "scroll for more" and not as cut off.
const FADE = '28px';
function useEdgeFade(dependency: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((was) => (was.start === start && was.end === end ? was : { start, end }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure, dependency]);
  if (!edges.start && !edges.end) return { ref, fade: undefined };
  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'}, #000 ${edges.start ? FADE : '0px'}, #000 calc(100% - ${edges.end ? FADE : '0px'}), ${edges.end ? 'transparent' : '#000'})`;
  return { ref, fade: { maskImage: mask, WebkitMaskImage: mask } };
}

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={`text-xs tabular-nums ${on ? 'opacity-70' : 'text-slate-500 dark:text-slate-400'}`}
    >
      {n.toLocaleString()}
    </span>
  );
}
