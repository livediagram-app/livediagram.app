'use client';

// A gallery's tile (docs/specs/026-plan/board-widgets.md "Each widget is a tile", item-types.md "Fields and Tabs": Add
// Field), shared by Add a Widget and Add Field: a strip on top drawing what the tile adds (inert, only a picture), then
// its glyph, name and line, and a badge at the strip's top right. The whole tile is one button. It lifts a pixel on
// hover (not with reduced motion); a chosen tile is ringed in the brand colour; a disabled one is dimmed, its reason
// in a tooltip.
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { Tooltip } from '@liveplanner/ui';

// Where a tile's badge sits: the strip's top right, where it never squeezes the name.
export const TILE_BADGE_SPOT = 'pointer-events-none absolute right-2 top-2';

// The strip's content whole: wider than its tile (a Breakdown naming long values), it is drawn smaller, never cut off.
export function FitWidth({ children }: { children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const room = box.current?.clientWidth ?? 0;
      const need = inner.current?.scrollWidth ?? 0;
      setScale(room > 0 && need > room ? room / need : 1);
    };
    fit();
    if (typeof ResizeObserver === 'undefined' || !box.current) return;
    const watch = new ResizeObserver(fit);
    watch.observe(box.current);
    return () => watch.disconnect();
  }, []);
  return (
    <span ref={box} className="flex min-w-0 flex-1 items-center">
      <span
        ref={inner}
        className="inline-flex origin-left"
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </span>
    </span>
  );
}

export function GalleryTile({
  strip,
  stripStyle,
  glyph,
  name,
  line,
  lineId,
  badge,
  label,
  describedBy,
  pressed,
  chosen = false,
  disabled = false,
  tooltip,
  onPress,
  rootRef,
  rootData,
  buttonData,
}: {
  strip: ReactNode;
  // The strip's own colours (a board's palette); else the gallery's quiet grey.
  stripStyle?: CSSProperties | undefined;
  glyph: ReactNode;
  name: string;
  line: string;
  lineId?: string;
  badge?: ReactNode;
  // The button's accessible name, and what describes it.
  label: string;
  describedBy?: string | undefined;
  // A toggling tile's state (aria-pressed).
  pressed?: boolean;
  // Ringed in the brand colour (a widget On Board).
  chosen?: boolean;
  disabled?: boolean;
  // The reason a disabled tile can't be pressed; its text must be in `label`.
  tooltip?: string;
  onPress: () => void;
  rootRef?: Ref<HTMLDivElement>;
  rootData?: Record<`data-${string}`, string>;
  buttonData?: Record<`data-${string}`, string>;
}) {
  const button = (
    <button
      type="button"
      {...buttonData}
      aria-label={label}
      aria-describedby={describedBy}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onPress}
      className={`absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    />
  );
  return (
    <div
      ref={rootRef}
      {...rootData}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition duration-micro motion-reduce:transition-none dark:bg-slate-900 ${
        chosen
          ? 'border-brand-400 ring-1 ring-brand-400 dark:border-brand-400/80 dark:ring-brand-400/60'
          : 'border-slate-200 dark:border-slate-700'
      } ${
        disabled
          ? 'opacity-55'
          : 'hover:-translate-y-px hover:border-brand-300 hover:shadow-md motion-reduce:hover:translate-y-0 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        inert
        className={`pointer-events-none flex h-14 w-full items-center overflow-hidden px-3 ${
          stripStyle
            ? ''
            : 'border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
        }`}
        style={stripStyle}
      >
        {strip}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          <span
            aria-hidden
            className={`flex shrink-0 [&_svg]:size-3.5 ${chosen ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 group-hover:text-brand-700 dark:group-hover:text-brand-300'}`}
          >
            {glyph}
          </span>
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </span>
        <span
          id={lineId}
          className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400"
        >
          {line}
        </span>
      </span>
      {badge}
      {disabled && tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button}
    </div>
  );
}
