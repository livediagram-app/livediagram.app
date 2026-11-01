'use client';

// One tile of the widget gallery (docs/specs/026-plan/board-widgets.md "Each widget is a tile"): a strip drawing the
// widget live from the board's own cards, in its own colours, as it would sit in the header (inert there), then its
// glyph, name and line. The whole tile is one button: it adds the widget, or takes it off when the board has it
// (On Board, with a check). The preview is drawn only once the tile has come into view (use-seen.ts).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, PlusIcon, Tooltip } from '@liveplanner/ui';
import { BoardWidgetArt, FieldWidgetArt } from '../plan-tile-art';
import type { PlanPalette } from '../plan-palette';
import type { GalleryTile } from './widget-gallery-model';
import { useSeen } from './use-seen';

export const FIELD_CAP_HINT = 'A board holds up to 12 field widgets';

// The preview whole: a widget wider than its tile (a Breakdown naming long values) is drawn smaller, never cut off.
function FitWidth({ children }: { children: ReactNode }) {
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

export function WidgetGalleryTile({
  tile,
  on,
  capped,
  preview,
  palette,
  onToggle,
}: {
  tile: GalleryTile;
  // The board has it.
  on: boolean;
  // A field widget the board has no room for (FIELD_WIDGETS_MAX reached).
  capped: boolean;
  preview?: ((id: GalleryTile['id']) => ReactNode) | undefined;
  palette?: PlanPalette | undefined;
  onToggle: () => void;
}) {
  const [ref, seen] = useSeen();
  const glyph = tile.view ? (
    <FieldWidgetArt view={tile.view} size={14} />
  ) : tile.kind ? (
    <BoardWidgetArt kind={tile.kind} size={14} />
  ) : null;
  const name = on ? `Remove ${tile.fullName}` : `Add ${tile.fullName}`;
  const button = (
    <button
      type="button"
      data-widget-card=""
      aria-label={capped ? `${name}: ${FIELD_CAP_HINT}` : name}
      aria-pressed={on}
      aria-disabled={capped || undefined}
      onClick={capped ? undefined : onToggle}
      className={`absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
        capped ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    />
  );
  return (
    <div
      ref={ref}
      data-gallery-tile={tile.id}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border transition duration-micro motion-reduce:transition-none ${
        on
          ? 'border-brand-400 ring-1 ring-brand-400 dark:border-brand-400/80 dark:ring-brand-400/60'
          : 'border-slate-200 dark:border-slate-700'
      } ${
        capped
          ? 'opacity-55'
          : 'hover:-translate-y-px hover:border-brand-300 hover:shadow-md motion-reduce:hover:translate-y-0 dark:hover:border-brand-500/60'
      }`}
    >
      {/* The widget live, as it would sit in this board's header. */}
      <span
        aria-hidden
        inert
        className="pointer-events-none flex h-14 w-full items-center overflow-hidden px-3"
        style={
          palette
            ? {
                backgroundColor: palette.surface,
                color: palette.text,
                borderBottom: `1px solid ${palette.border}`,
              }
            : undefined
        }
      >
        {seen && preview ? (
          <FitWidth>{preview(tile.id)}</FitWidth>
        ) : (
          // A still placeholder the widget's shape until the tile is in view.
          <span
            data-preview-placeholder=""
            className="h-7 w-32 rounded-md border"
            style={
              palette ? { borderColor: palette.border, backgroundColor: palette.column } : undefined
            }
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          <span
            aria-hidden
            className={`flex shrink-0 ${on ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 group-hover:text-brand-700 dark:group-hover:text-brand-300'}`}
          >
            {glyph}
          </span>
          <span className="min-w-0 flex-1 truncate">{tile.name}</span>
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {tile.line}
        </span>
      </span>
      {/* On Board, or Add on hover, at the strip's top right where it never squeezes the name. */}
      {on ? (
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm dark:bg-brand-600">
          <CheckIcon size={9} />
          On Board
        </span>
      ) : capped ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:border-brand-500/40 dark:bg-slate-900 dark:text-brand-200"
        >
          <PlusIcon size={9} />
          Add
        </span>
      )}
      {capped ? <Tooltip label={FIELD_CAP_HINT}>{button}</Tooltip> : button}
    </div>
  );
}
