'use client';

// A count as a badge (docs/specs/026-plan/board-widgets.md "The header"): the figure in a small pill,
// centred on its cap band, in a tint that sets it off from what it sits on. Column heads and board
// widgets share it, so every lone number on a board reads the same way.
import type { ReactNode } from 'react';

export function CountBadge({
  children,
  background,
  color,
  label,
}: {
  children: ReactNode;
  background: string;
  color: string;
  // A spoken name when the figure alone would not say what it counts.
  label?: string;
}) {
  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
      style={{ backgroundColor: background, color }}
      aria-label={label}
    >
      <span className="text-optical-centre">{children}</span>
    </span>
  );
}
