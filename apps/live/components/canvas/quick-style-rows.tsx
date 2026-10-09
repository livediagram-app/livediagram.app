'use client';

// The quick style panel's rows (docs/specs/008-canvas/quick-style-panel.md "Accessibility"), each
// with its own accessible name and one Tab stop. A row of glyph buttons is a radio group whose
// arrows move and choose. A colour row is the colour picker's (docs/specs/004-interface-design/
// colour-picker.md): the one swatch, toggle buttons, arrows that move focus without picking, Enter
// or Space to pick, and More colours at its end.

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Tooltip, Glyph } from '@livediagram/ui';
import { SwatchChip } from '@/components/colour/ColourSwatch';
import { colourKeyTarget } from '@/components/colour/useColourKeys';
import { QUICK_TARGET_PX } from './quick-style-metrics';

export type QuickOption<V> = {
  value: V;
  // The accessible name, and the tooltip.
  name: string;
  content: ReactNode;
  // A swatch paints its own colour; every other option is a glyph button.
  swatch?: string;
  // A custom colour in place of the theme's: drawn with a corner marker.
  overridden?: boolean;
};

// 20 px chips in touching 24 px targets, so the row is exactly as many targets wide as it has
// (a longer row widens the panel; a row never wraps). Every target is 24 x 24 px (WCAG 2.5.8).
export function QuickRadioRow<V extends string | number>({
  title,
  showTitle,
  options,
  value,
  onChoose,
  onOptionContext,
  testId,
  columns,
  more,
}: {
  title: string;
  showTitle: boolean;
  options: readonly QuickOption<V>[];
  value: V | null;
  onChoose: (value: V) => void;
  // Right-click, Shift+F10 or the context-menu key on an option.
  onOptionContext?: (value: V, button: HTMLButtonElement) => void;
  testId: string;
  // Swatches on a grid of this many 24 px columns, touching, so a shorter row lines up under a
  // full one. Unset: a flex row. On a row of
  // buttons, how many share the row (unset: three).
  columns?: number;
  // A colour row's last target: More colours, the full picker.
  more?: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const rowRef = useRef<HTMLDivElement>(null);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const tabStop = checkedIndex >= 0 ? checkedIndex : 0;
  const isSwatchRow = options.some((o) => o.swatch !== undefined);

  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length;
    refs.current[next]?.focus();
    onChoose(options[next]!.value);
  };
  const openContext = (index: number) => {
    const button = refs.current[index];
    if (button && onOptionContext) onOptionContext(options[index]!.value, button);
  };
  // A colour row moves focus only, More colours included, as the colour picker does.
  const moveFocus = (e: KeyboardEvent<HTMLElement>) => {
    const keys = Array.from(
      rowRef.current?.querySelectorAll<HTMLElement>('[data-colour-key]') ?? [],
    );
    const next = colourKeyTarget(e.key, keys.indexOf(e.target as HTMLElement), keys.length);
    if (next < 0) return false;
    keys[next]?.focus();
    return true;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
      e.preventDefault();
      e.stopPropagation();
      openContext(index);
      return;
    }
    if (isSwatchRow) {
      if (!moveFocus(e)) return;
    } else {
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
    }
    e.preventDefault();
    e.stopPropagation();
  };

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
        ref={rowRef}
        role={isSwatchRow ? 'group' : 'radiogroup'}
        aria-label={title}
        data-testid={testId}
        onKeyDown={
          isSwatchRow
            ? (e) => {
                // More colours' own keys land here; the swatches handle theirs.
                if ((e.target as HTMLElement).dataset.quickMore === undefined) return;
                if (moveFocus(e)) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            : undefined
        }
        className={
          isSwatchRow && columns
            ? 'grid'
            : isSwatchRow
              ? 'flex'
              : columns
                ? 'grid gap-1'
                : 'grid grid-cols-3 gap-1'
        }
        style={
          isSwatchRow && columns
            ? {
                gridTemplateColumns: `repeat(${columns}, ${QUICK_TARGET_PX}px)`,
                justifyContent: 'start',
              }
            : columns
              ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
              : undefined
        }
      >
        {options.map((o, i) => {
          const checked = i === checkedIndex;
          const swatch = o.swatch !== undefined;
          return (
            <Tooltip key={String(o.value)} label={o.name}>
              <button
                ref={(node) => {
                  refs.current[i] = node;
                }}
                type="button"
                role={swatch ? undefined : 'radio'}
                aria-checked={swatch ? undefined : checked}
                aria-pressed={swatch ? checked : undefined}
                aria-label={o.name}
                tabIndex={i === tabStop ? 0 : -1}
                data-colour-key={swatch ? '' : undefined}
                data-overridden={o.overridden ? '' : undefined}
                onClick={() => onChoose(o.value)}
                onKeyDown={(e) => onKeyDown(e, i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openContext(i);
                }}
                className={
                  swatch
                    ? 'group relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                    : `flex h-7 w-full items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        checked
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`
                }
              >
                {swatch ? (
                  <SwatchChip colour={o.swatch!} picked={checked} marked={o.overridden === true} />
                ) : (
                  o.content
                )}
              </button>
            </Tooltip>
          );
        })}
        {isSwatchRow ? more : null}
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
    <Glyph size={14} units={16}>
      <path d="M9.5 2.5 13.5 6.5 7 13H3.5L2 11.5z" />
      <path d="M6 6l4 4" />
      <path d="M8 13h6" />
    </Glyph>
  );
}
