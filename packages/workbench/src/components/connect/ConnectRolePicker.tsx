'use client';

// The Connect list's role (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): three segments in one
// track, Editor first and chosen, a radio group the arrows walk. Picked before the file, so it offers every role; a
// file whose app lacks the chosen one says so on its row. Painted from the list's ink.
import type { KeyboardEvent } from 'react';
import type { Level } from '@liveworkspace/index-client';
import { CONNECT_LEVELS, LEVEL_TITLES } from './connect-words';

export function ConnectRolePicker({
  level,
  onChange,
  describedBy,
}: {
  level: Level;
  onChange: (level: Level) => void;
  describedBy?: string;
}) {
  const index = CONNECT_LEVELS.indexOf(level);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = CONNECT_LEVELS.length - 1;
    const to: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    const next = CONNECT_LEVELS[(to[e.key]! + CONNECT_LEVELS.length) % CONNECT_LEVELS.length]!;
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Role for the file you connect"
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className="relative grid grid-cols-3 rounded-[10px] bg-[var(--cp-column)] p-0.5"
    >
      {/* The chosen segment's card slides to it (transform only). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-lg bg-[var(--cp-card)] shadow-sm ring-1 ring-[var(--cp-border)] transition-transform duration-short ease-out motion-reduce:transition-none"
        style={{ width: 'calc((100% - 4px) / 3)', transform: `translateX(${index * 100}%)` }}
      />
      {CONNECT_LEVELS.map((l) => {
        const on = l === level;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-level={l}
            onClick={() => onChange(l)}
            className={`relative z-10 cursor-pointer rounded-lg px-2 py-1.5 text-[12px] font-semibold outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] motion-reduce:transition-none ${
              on ? 'text-[var(--cp-text)]' : 'text-[var(--cp-muted)] hover:text-[var(--cp-text)]'
            }`}
          >
            {LEVEL_TITLES[l]}
          </button>
        );
      })}
    </div>
  );
}
