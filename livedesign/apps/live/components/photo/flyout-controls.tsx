'use client';

// The options flyout's controls (docs/specs/031-photo/photo-pages.md "The options flyout"), laid out in place as the
// palette's category flyout lays out its tiles: a titled section with the flyout's rule, a number as a row with its
// value and a filled slider, a short choice as picture tiles, an on and off option as a switch with its line, and a
// long choice (the blend modes, the fonts) as a row that opens its popover. Each tells the footer what it is when
// pointed at.
import { useState, type ReactNode } from 'react';
import { SwitchRow as SharedSwitchRow } from '@livedesign/ui';
import { CHOICE_BLURBS, OPTION_GUIDES } from '@/lib/photo-editor/option-guides';
import { fromLogPosition, logScaled, toLogPosition } from './slider-scale';
import { choicePicture } from './option-pictures';

/** What the footer shows for a pointed-at control. */
export type Pointed = { name: string; text: string; shortcut?: string | undefined } | null;

export const guideLine = (guide: string, label: string): string =>
  OPTION_GUIDES[guide]?.blurb ?? label;

export function FlyoutSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <h4 className="flex items-center gap-2 px-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {title}
        <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
      </h4>
      {children}
    </section>
  );
}

/** A number: its name and value (typed straight in) over a slider filled to it. */
export function SliderRow({
  label,
  guide,
  value,
  min,
  max,
  step = 1,
  unit = '',
  scale = 1,
  onChange,
  onPoint,
  compact = false,
}: {
  label: string;
  // The option's field key, for the footer's line; the label in lower case when absent.
  guide?: string;
  // The quick panel's quieter row: smaller type, the value bare until pointed at, a thinner track.
  compact?: boolean;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  scale?: number;
  onChange: (value: number) => void;
  // Where a flyout's footer is told what is pointed at; absent outside a flyout.
  onPoint?: (p: Pointed) => void;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const g = guide ?? label.toLowerCase();
  const log = logScaled(min, max);
  const shown = Math.round(value * scale * 100) / 100;
  const position = log ? toLogPosition(value, min, max) : value;
  const fill = log ? position / 10 : ((value - min) / (max - min || 1)) * 100;
  const commit = (text: string) => {
    setTyping(null);
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n / scale)));
  };
  return (
    <div
      className={`group/slider flex flex-col px-0.5 ${compact ? 'gap-1' : 'gap-1.5'}`}
      onPointerEnter={() =>
        onPoint?.({
          name: label,
          text: guideLine(g, label),
          shortcut: OPTION_GUIDES[g]?.keys,
        })
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            compact
              ? 'text-[11.5px] font-medium text-slate-500 dark:text-slate-400'
              : 'text-[12.5px] font-medium text-slate-700 dark:text-slate-200'
          }
        >
          {label}
        </span>
        <label
          className={`flex items-baseline gap-1 rounded-md px-1.5 py-0.5 focus-within:ring-2 focus-within:ring-brand-400 ${
            compact
              ? 'ring-1 ring-transparent transition group-hover/slider:ring-slate-200 dark:group-hover/slider:ring-slate-700'
              : 'ring-1 ring-slate-200 dark:ring-slate-700'
          }`}
        >
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            value={typing ?? `${shown}`}
            onChange={(e) => setTyping(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setTyping(null);
            }}
            style={{ width: `${Math.max(2, (typing ?? `${shown}`).length) + 0.5}ch` }}
            className="bg-transparent text-right text-[12.5px] font-semibold tabular-nums text-slate-900 outline-none dark:text-slate-50"
          />
          {unit ? (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          ) : null}
        </label>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={`${shown}${unit ? ` ${unit}` : ''}`}
        min={log ? 0 : min}
        max={log ? 1000 : max}
        step={log ? 1 : step}
        value={position}
        onChange={(e) => {
          const p = Number(e.target.value);
          onChange(log ? fromLogPosition(p, min, max, step) : p);
        }}
        // Dragged with the pointer, it lets go of the focus, so the photo's keys (a tool's letter, [ and ]) work at
        // once; reached by Tab it keeps it, and the arrows move it.
        onPointerUp={(e) => e.currentTarget.blur()}
        style={{
          background: `linear-gradient(90deg, var(--color-brand-500) ${fill}%, var(--slider-rest) ${fill}%)`,
        }}
        className={`${compact ? 'h-1' : 'h-1.5'} w-full cursor-pointer appearance-none rounded-full accent-brand-500 [--slider-rest:var(--color-slate-200)] dark:[--slider-rest:var(--color-slate-700)]`}
      />
    </div>
  );
}

/** A short choice as tiles, each its picture over its name; the chosen one marked. */
export function TileChoice<T extends string | number>({
  label,
  guide,
  value,
  choices,
  onChange,
  onPoint,
  keys,
  named = true,
}: {
  label: string;
  guide: string;
  // Its name over the tiles; not where its section has the same name.
  named?: boolean;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  onPoint: (p: Pointed) => void;
  // A choice's key, for its tile and the footer.
  keys?: Readonly<Record<string, string>>;
}) {
  // One row up to five; past that, rows of four.
  const columns = choices.length <= 5 ? choices.length : 4;
  return (
    <div className="flex flex-col gap-1.5">
      {named ? (
        <span className="px-0.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        className="grid gap-1.5"
      >
        {choices.map((c) => {
          const on = c.value === value;
          const picture = choicePicture(guide, c.value);
          return (
            <button
              key={String(c.value)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={c.label}
              onClick={() => onChange(c.value)}
              onPointerEnter={() =>
                onPoint({
                  name: c.label,
                  text: CHOICE_BLURBS[guide]?.[String(c.value)] ?? '',
                  shortcut: keys?.[String(c.value)],
                })
              }
              className={`group flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                on
                  ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-500/50'
                  : 'text-slate-600 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800/70'
              }`}
            >
              {picture ? (
                <span
                  aria-hidden
                  className="flex h-8 w-full items-center justify-center overflow-hidden rounded-lg transition-transform duration-micro group-hover:-translate-y-0.5"
                >
                  {picture}
                </span>
              ) : null}
              <span className="w-full truncate text-center text-[11px] font-medium leading-tight">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** An on and off option: its name and line, and a switch. */
export function SwitchRow({
  label,
  guide,
  on,
  onChange,
  onPoint,
}: {
  label: string;
  guide: string;
  on: boolean;
  onChange: (on: boolean) => void;
  onPoint: (p: Pointed) => void;
}) {
  const line = OPTION_GUIDES[guide]?.blurb;
  return (
    <SharedSwitchRow
      checked={on}
      onChange={onChange}
      aria-label={label}
      onPointerEnter={() => onPoint({ name: label, text: line ?? '' })}
      layout="group flex w-full items-center justify-between gap-3 rounded-xl text-left"
      className="px-2 py-1.5 ring-1 ring-transparent transition hover:bg-slate-50 hover:ring-slate-200 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        {line ? (
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{line}</span>
        ) : null}
      </span>
    </SharedSwitchRow>
  );
}

/** A row naming an option, its control at the end (a long choice's popover button, a gradient's strip). */
export function ControlRow({
  label,
  guide,
  onPoint,
  children,
}: {
  label: string;
  guide: string;
  onPoint: (p: Pointed) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-0.5"
      onPointerEnter={() => onPoint({ name: label, text: guideLine(guide, label) })}
    >
      <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </div>
  );
}
