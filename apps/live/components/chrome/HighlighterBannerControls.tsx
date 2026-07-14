import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';

// The highlighter banner's two popover controls (spec/81): stroke
// strength and colour, applied to the NEXT marker strokes. They sit in
// the ModeBanner extras slot beside Cancel, the same home as the
// pencil's recognise-shapes toggle. Each button opens a small anchored
// popover; outside-pointerdown or Escape closes it.

// The marker colour cup: yellow (the default) + the classic marker set.
const HIGHLIGHTER_COLORS = [
  { value: '#fde047', label: 'Yellow' },
  { value: '#86efac', label: 'Green' },
  { value: '#f9a8d4', label: 'Pink' },
  { value: '#93c5fd', label: 'Blue' },
  { value: '#fdba74', label: 'Orange' },
] as const;

// Strength presets: px stroke widths, drawn as bars in the popover.
const HIGHLIGHTER_WIDTHS = [
  { value: 8, label: 'Thin' },
  { value: 14, label: 'Medium' },
  { value: 22, label: 'Bold' },
] as const;

export function HighlighterBannerControls({
  color,
  width,
  onSetColor,
  onSetWidth,
}: {
  color: string;
  width: number;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
}) {
  const [open, setOpen] = useState<'width' | 'color' | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside pointerdown / Escape while a popover is open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Consume so the editor's Escape doesn't also disarm the tool.
        e.stopImmediatePropagation();
        e.preventDefault();
        setOpen(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [open]);

  const buttonClass =
    'flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 transition hover:bg-slate-50';
  const popoverClass =
    'absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800';

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <Tooltip title="Stroke strength" description="How wide the next highlighter strokes draw.">
        <button
          type="button"
          aria-label="Highlighter stroke strength"
          aria-expanded={open === 'width'}
          onClick={() => setOpen(open === 'width' ? null : 'width')}
          className={buttonClass}
        >
          {/* Three stacked bars of increasing weight read as "stroke
              strength" at 14px. */}
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path d="M2 3.5 H14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <path d="M2 8 H14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M2 12.5 H14" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip title="Highlighter colour" description="The colour the next strokes draw in.">
        <button
          type="button"
          aria-label="Highlighter colour"
          aria-expanded={open === 'color'}
          onClick={() => setOpen(open === 'color' ? null : 'color')}
          className={buttonClass}
        >
          <span
            className="h-3.5 w-3.5 rounded-full border border-slate-300"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        </button>
      </Tooltip>
      {open === 'width' ? (
        <div className={popoverClass} role="menu" aria-label="Stroke strength">
          <div className="flex flex-col gap-0.5">
            {HIGHLIGHTER_WIDTHS.map((w) => (
              <button
                key={w.value}
                type="button"
                role="menuitemradio"
                aria-checked={width === w.value}
                onClick={() => {
                  onSetWidth(w.value);
                  setOpen(null);
                }}
                className={
                  'flex w-28 items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ' +
                  (width === w.value
                    ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60')
                }
              >
                {/* The bar previews the actual committed translucency +
                    the preset's relative weight. */}
                <span
                  className="h-1 flex-1 rounded-full"
                  style={{
                    backgroundColor: color,
                    opacity: 0.6,
                    height: Math.max(3, w.value / 2.4),
                  }}
                  aria-hidden
                />
                {w.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {open === 'color' ? (
        <div className={popoverClass} role="menu" aria-label="Highlighter colour">
          <div className="flex items-center gap-1">
            {HIGHLIGHTER_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="menuitemradio"
                aria-checked={color === c.value}
                aria-label={c.label}
                onClick={() => {
                  onSetColor(c.value);
                  setOpen(null);
                }}
                className={
                  'flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-700/60 ' +
                  (color === c.value ? 'ring-2 ring-brand-400' : '')
                }
              >
                <span
                  className="h-4 w-4 rounded-full border border-slate-300"
                  style={{ backgroundColor: c.value }}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
