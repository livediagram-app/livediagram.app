'use client';

// The role switch every place that hands out a pass draws (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Connecting", kits.md "Starting a kit"): its options as segments in one track, a radio group the arrows walk, the
// chosen segment's card sliding to it. Painted from the panel's ink (`--cp-*`, PANEL_INK when the place has none).
import type { KeyboardEvent } from 'react';

/** The connect panels' own look when no ink is handed in: slate on white, and its dark counterpart. */
export const PANEL_INK =
  '[--cp-text:#0f172a] [--cp-muted:#475569] [--cp-border:#e2e8f0] [--cp-surface:#f8fafc] [--cp-column:#f1f5f9] [--cp-card:#ffffff] [--cp-accent:var(--color-brand-700)] [--cp-on-accent:#ffffff] dark:[--cp-text:#e2e8f0] dark:[--cp-muted:#94a3b8] dark:[--cp-border:#334155] dark:[--cp-surface:#111827] dark:[--cp-column:#1e293b] dark:[--cp-card:#0f172a] dark:[--cp-accent:var(--color-brand-400)] dark:[--cp-on-accent:#0f172a]';

export type RoleOption<T extends string> = { value: T; label: string };

export function RoleSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
  describedBy,
  size = 'small',
}: {
  value: T;
  options: readonly RoleOption<T>[];
  onChange: (value: T) => void;
  // The group's accessible name ("Role for the file you connect").
  label: string;
  describedBy?: string;
  // `small` in a panel's list; `large` on a page, where it is a 44px target.
  size?: 'small' | 'large';
}) {
  const count = options.length;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const to: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    const next = options[(to[e.key]! + count) % count]!.value;
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className="relative grid rounded-[10px] bg-[var(--cp-column)] p-0.5"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {/* The chosen segment's card slides to it (transform only). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-lg bg-[var(--cp-card)] shadow-sm ring-1 ring-[var(--cp-border)] transition-transform duration-short ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 4px) / ${count})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-value={option.value}
            onClick={() => onChange(option.value)}
            className={`relative z-10 cursor-pointer rounded-lg px-2 font-semibold outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] motion-reduce:transition-none ${
              size === 'large' ? 'min-h-11 text-sm' : 'py-1.5 text-[12px]'
            } ${on ? 'text-[var(--cp-text)]' : 'text-[var(--cp-muted)] hover:text-[var(--cp-text)]'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
