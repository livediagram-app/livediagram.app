'use client';

// More, at the end of a too-full widget zone (docs/specs/026-plan/board-widgets.md "The header", Work Tracker 880): a
// header-sized button holding the widgets that do not fit, "More", how many and a chevron. While one of them holds a
// press it reads pressed and names it in place of "More", so a filter never hides in it. It opens More Widgets, a
// panel of those widgets, live, one to a line. A ghost copy (unpressed, a two-digit count) sits in the zone's
// measuring layer, so the fit knows More's width before it shows.
import type { ReactNode } from 'react';
import { ChevronDownIcon, CountBadge } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import type { PlanPalette } from '../plan-palette';
import { WIDGET_PILL } from './board-widget-parts';

// The More Widgets panel's width: the widest widget it holds and its padding, within these.
export const MORE_PANEL_MIN_PX = 200;
export const MORE_PANEL_MAX_PX = 420;
const PANEL_PADDING_PX = 18;

// The panel's width for the widest widget it holds.
export function morePanelWidth(widest: number): number {
  return Math.max(MORE_PANEL_MIN_PX, Math.min(MORE_PANEL_MAX_PX, widest + PANEL_PADDING_PX));
}

// The accessible name: how many, and the press it names.
export function moreName(count: number, label: string | null): string {
  return `More widgets, ${count} more${label ? `, pressed: ${label}` : ''}`;
}

function MoreFace({
  count,
  label,
  palette,
}: {
  count: number;
  label: string | null;
  palette: PlanPalette;
}) {
  return (
    <>
      {label ? <span className="max-w-[120px] truncate">{label}</span> : 'More'}
      <CountBadge
        size="md"
        background={label ? `${palette.focus}26` : palette.column}
        color={label ? palette.focus : palette.text}
      >
        {count}
      </CountBadge>
      <ChevronDownIcon size={12} />
    </>
  );
}

export function ZoneMoreGhost({ palette }: { palette: PlanPalette }) {
  return (
    <span data-widget-more-ghost="" className={WIDGET_PILL}>
      <MoreFace count={88} label={null} palette={palette} />
    </span>
  );
}

export function ZoneMore({
  count,
  label,
  palette,
  open,
  onToggle,
  onClose,
  panelWidth,
  children,
}: {
  count: number;
  // The press a widget in More holds, named; null when none does.
  label: string | null;
  palette: PlanPalette;
  // The button the panel hangs from while it is open.
  open: HTMLElement | null;
  onToggle: (button: HTMLElement) => void;
  onClose: () => void;
  panelWidth: number;
  // The widgets More holds, as the zone wraps them.
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        data-widget-more=""
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        aria-label={moreName(count, label)}
        className={`${WIDGET_PILL} cursor-pointer outline-none transition hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/10 ${
          label ? 'font-semibold' : ''
        }`}
        style={{
          borderColor: label ? palette.focus : palette.border,
          color: label ? palette.focus : palette.muted,
          backgroundColor: label ? `${palette.focus}1f` : undefined,
          ['--tw-ring-color' as string]: palette.focus,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(e.currentTarget);
        }}
      >
        <MoreFace count={count} label={label} palette={palette} />
      </button>
      {open ? (
        <AnchoredPopover
          anchor={open}
          name="More Widgets"
          width={panelWidth}
          align="end"
          preventScroll
          onClose={onClose}
        >
          <div
            data-widget-more-panel=""
            className="flex flex-col gap-1.5 rounded-lg border p-2"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span
              className="px-0.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: palette.muted }}
            >
              More Widgets
            </span>
            <div
              role="list"
              aria-label="More widgets"
              className="flex flex-col items-start gap-1.5"
            >
              {children}
            </div>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
