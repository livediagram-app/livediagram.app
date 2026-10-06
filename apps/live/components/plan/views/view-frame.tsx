'use client';

// What every visualisation shares (docs/specs/026-plan/plan-views.md "Visualisations"): the card it sits
// on in the board's theme colours, a header of its name and count, its loading and empty states, and the
// press rules for an entry that opens a card.
import type { ReactNode } from 'react';
import { STATUS_PHASES, STATUS_PHASE_LABELS } from '@livediagram/items';
import type { PlanPalette } from '../plan-palette';
import type { PlanContextValue } from '../PlanContext';
import { CountBadge } from '@livediagram/ui';

// The phase colours, the same on either surface: they read as status, not as theme.
export const PHASE_COLOURS = {
  todo: '#94a3b8',
  doing: '#3b82f6',
  done: '#16a34a',
} as const;
export const OVERDUE_RED = '#dc2626';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// An entry that opens a card: in Plan mode a press opens it (and keeps the press from the canvas); in any
// mode a double-click does (docs/specs/026-plan/plan-views.md "On the canvas").
export function openProps(plan: PlanContextValue | undefined, itemId: string) {
  const interactive = !!plan?.planInput;
  return {
    onPointerDown: interactive ? stop : undefined,
    onClick: (e: React.MouseEvent) => {
      if (!interactive) return;
      e.stopPropagation();
      plan?.openItem(itemId);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      plan?.openItem(itemId);
    },
  };
}

// What a view shows: loading while the cards are on their way, else empty or the chart.
export function viewState(
  plan: PlanContextValue | undefined,
  hasData: boolean,
): 'loading' | 'empty' | 'ready' {
  if (plan?.status === 'loading') return 'loading';
  return hasData ? 'ready' : 'empty';
}

export function ViewFrame({
  title,
  count,
  countLabel,
  palette,
  fontFamily,
  state,
  empty,
  aside,
  children,
}: {
  title: string;
  count?: number;
  // The count spoken whole ("3 projects").
  countLabel?: string;
  palette: PlanPalette;
  fontFamily?: string;
  // 'loading' before the cards arrive, 'empty' when there is nothing to chart.
  state: 'loading' | 'empty' | 'ready';
  empty: string;
  // Controls at the header's end (the calendar's month steps).
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.surface,
        color: palette.text,
        ...(fontFamily ? { fontFamily } : null),
      }}
    >
      <div
        className="flex h-10 shrink-0 items-center gap-2 border-b px-3"
        style={{ borderColor: palette.border }}
      >
        <span className="min-w-0 truncate text-[13px] font-semibold">{title}</span>
        {count !== undefined && state === 'ready' ? (
          <CountBadge size="md" background={palette.column} color={palette.text} label={countLabel}>
            {count}
          </CountBadge>
        ) : null}
        {aside ? <span className="ml-auto flex shrink-0 items-center gap-1">{aside}</span> : null}
      </div>
      {state === 'ready' ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
      ) : (
        <div
          className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 text-center text-[12px]"
          style={{ color: palette.muted }}
        >
          {state === 'loading' ? 'Loading cards…' : empty}
        </div>
      )}
    </div>
  );
}

// The three phases as a key.
export function PhaseLegend({ palette }: { palette: PlanPalette }) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
      style={{ color: palette.muted }}
    >
      {STATUS_PHASES.map((phase) => (
        <span key={phase} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: PHASE_COLOURS[phase] }}
          />
          {STATUS_PHASE_LABELS[phase]}
        </span>
      ))}
    </div>
  );
}
