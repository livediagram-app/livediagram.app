'use client';

// A rating picked from a scale (docs/specs/030-forms/forms.md "Question types" and "New card field kinds"): stars,
// or numbered buttons, as one radio group. Arrow keys move and pick, Home and End jump, and the picked star (or the
// first, with none) is the one Tab stops on. Shared by a card's Rating field, the form builder and the form page, so
// it carries no editor code.
import { useRef, type KeyboardEvent } from 'react';

const STAR_PATH =
  'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52 6.12 20.61l1.12-6.55L2.48 9.42l6.58-.96z';

export function RatingInput({
  value,
  scale,
  style = 'stars',
  onChange,
  disabled,
  size = 'md',
  label,
  lowLabel,
  highLabel,
  describedBy,
  invalid,
  accent,
}: {
  value: number | undefined;
  scale: number;
  style?: 'stars' | 'numbers';
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  // The group's accessible name (the question or field).
  label: string;
  lowLabel?: string;
  highLabel?: string;
  describedBy?: string;
  invalid?: boolean;
  // The colour a picked star or number takes; the brand colour when absent.
  accent?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pick = (n: number) => {
    if (disabled) return;
    onChange(n);
    refs.current[n - 1]?.focus();
  };
  const onKey = (e: KeyboardEvent, n: number) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? Math.min(scale, n + 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? Math.max(1, n - 1)
          : e.key === 'Home'
            ? 1
            : e.key === 'End'
              ? scale
              : null;
    if (next === null) return;
    e.preventDefault();
    pick(next);
  };
  const tabStop = value && value >= 1 && value <= scale ? value : 1;
  const colour = accent ?? 'var(--color-brand-600, #0284c7)';
  const starPx = size === 'lg' ? 32 : size === 'sm' ? 16 : 22;
  const items = Array.from({ length: scale }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        className={`flex flex-wrap items-center ${style === 'stars' ? 'gap-0.5' : 'gap-1.5'}`}
      >
        {items.map((n) => {
          const on = value !== undefined && n <= value;
          const picked = value === n;
          const name =
            style === 'stars' ? `${n} star${n === 1 ? '' : 's'} of ${scale}` : `${n} of ${scale}`;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={name}
              tabIndex={n === tabStop ? 0 : -1}
              disabled={disabled}
              onClick={() => pick(n)}
              onKeyDown={(e) => onKey(e, n)}
              className={
                style === 'stars'
                  ? 'rounded-md p-0.5 outline-none transition enabled:cursor-pointer enabled:hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--rating-accent)] disabled:opacity-60 motion-reduce:transition-none motion-reduce:enabled:hover:scale-100'
                  : `flex items-center justify-center rounded-lg border font-semibold tabular-nums outline-none transition enabled:cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--rating-accent)] focus-visible:ring-offset-1 disabled:opacity-60 ${
                      size === 'lg'
                        ? 'h-11 min-w-11 px-2 text-[15px]'
                        : size === 'sm'
                          ? 'h-7 min-w-7 px-1 text-[12px]'
                          : 'h-9 min-w-9 px-1.5 text-[13px]'
                    } ${
                      picked
                        ? 'border-transparent text-white'
                        : 'border-slate-300 bg-white text-slate-700 enabled:hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                    }`
              }
              style={
                {
                  '--rating-accent': colour,
                  ...(style === 'numbers' && picked ? { background: colour } : {}),
                } as React.CSSProperties
              }
            >
              {style === 'stars' ? (
                <svg
                  width={starPx}
                  height={starPx}
                  viewBox="0 0 24 24"
                  aria-hidden
                  fill={on ? colour : 'none'}
                  stroke={on ? colour : 'currentColor'}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  className={on ? '' : 'text-slate-400 dark:text-slate-500'}
                >
                  <path d={STAR_PATH} />
                </svg>
              ) : (
                n
              )}
            </button>
          );
        })}
      </div>
      {style === 'numbers' && (lowLabel || highLabel) ? (
        <div className="flex justify-between gap-4 text-[12px] text-slate-500 dark:text-slate-400">
          <span>{lowLabel ? `1: ${lowLabel}` : ''}</span>
          <span>{highLabel ? `${scale}: ${highLabel}` : ''}</span>
        </div>
      ) : null}
    </div>
  );
}
