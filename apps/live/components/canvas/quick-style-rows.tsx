'use client';

// The quick style panel's rows (docs/specs/008-canvas/quick-style-panel.md "Accessibility"): each one a
// radio group with its own accessible name, the options radios with their own
// names repeated by a Tooltip. Arrow keys move and choose, one tab stop a row.

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';

export type QuickOption<V> = {
  value: V;
  // The accessible name, and the tooltip.
  name: string;
  content: ReactNode;
  // A swatch paints its own colour; every other option is a glyph button.
  swatch?: string;
};

export function QuickRadioRow<V extends string | number>({
  title,
  showTitle,
  options,
  value,
  onChoose,
  testId,
}: {
  title: string;
  showTitle: boolean;
  options: readonly QuickOption<V>[];
  value: V | null;
  onChoose: (value: V) => void;
  testId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const tabStop = checkedIndex >= 0 ? checkedIndex : 0;

  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length;
    refs.current[next]?.focus();
    onChoose(options[next]!.value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step !== 0) moveTo(index + step);
    else if (e.key === 'Home') moveTo(0);
    else if (e.key === 'End') moveTo(options.length - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const isSwatchRow = options.some((o) => o.swatch !== undefined);
  return (
    <div className="flex flex-col gap-1">
      {showTitle ? (
        <span
          aria-hidden
          className="select-none px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          {title}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={title}
        data-testid={testId}
        className={isSwatchRow ? 'flex justify-between gap-1' : 'grid grid-cols-3 gap-1'}
      >
        {options.map((o, i) => {
          const checked = i === checkedIndex;
          return (
            <Tooltip key={String(o.value)} label={o.name}>
              <button
                ref={(node) => {
                  refs.current[i] = node;
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={o.name}
                tabIndex={i === tabStop ? 0 : -1}
                onClick={() => onChoose(o.value)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={
                  o.swatch !== undefined
                    ? `h-6 w-6 shrink-0 rounded-md border border-black/15 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-white/20 dark:focus-visible:ring-offset-slate-900 ${
                        checked
                          ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-brand-300 dark:ring-offset-slate-900'
                          : 'hover:scale-110'
                      }`
                    : `flex h-7 w-full items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        checked
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`
                }
                style={o.swatch !== undefined ? { backgroundColor: o.swatch } : undefined}
              >
                {o.content}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// --- Glyphs (18px, the 16-grid house style) --------------------------------

export function FlowingLineGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="12"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 2.5"
        strokeLinecap="round"
      />
      <path
        d="M11.5 5.5 15.5 9l-4 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TextAlignGlyph({ align }: { align: 'left' | 'center' | 'right' }) {
  const rows = [12, 8, 12, 6];
  const x = (w: number) => (align === 'left' ? 3 : align === 'right' ? 15 - w : 9 - w / 2);
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      {rows.map((w, i) => (
        <rect
          key={i}
          x={x(w)}
          y={3.5 + i * 3.2}
          width={w}
          height="1.6"
          rx="0.8"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

// The icon (a filled square) beside, above or after two lines of label.
export function IconAlignGlyph({ align }: { align: 'left' | 'above' | 'right' }) {
  if (align === 'above') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect x="6.5" y="2" width="5" height="5" rx="1" fill="currentColor" />
        <rect x="3" y="10" width="12" height="1.6" rx="0.8" fill="currentColor" opacity="0.7" />
        <rect x="5" y="13.5" width="8" height="1.6" rx="0.8" fill="currentColor" opacity="0.7" />
      </svg>
    );
  }
  const iconX = align === 'left' ? 1.5 : 11.5;
  const textX = align === 'left' ? 8.5 : 1.5;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect x={iconX} y="6.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x={textX} y="6.8" width="8" height="1.6" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x={textX} y="9.8" width="6" height="1.6" rx="0.8" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function ClearStylesGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 2.5 13.5 6.5 7 13H3.5L2 11.5z" />
      <path d="M6 6l4 4" />
      <path d="M8 13h6" />
    </svg>
  );
}
