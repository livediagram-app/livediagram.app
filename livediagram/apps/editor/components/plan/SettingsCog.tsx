'use client';

// A Plan element's settings cog (a board's Board Settings in a Dashboard slot, a Sheet's Sheet Settings, a chart's
// Chart Settings, a Dashboard slot's own Slot Settings): its one menu, in its header (never a ⋯ beside it), opening a
// popover of collapsible sections, one open at a time. A press outside or Escape closes it, handing focus back to the
// cog. Presses in it are its own, never the canvas's or the element's.
import { useState, type ReactNode } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideSettings } from '@livediagram/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import type { PlanPalette } from './plan-palette';
import { useSlotSettings } from './dashboard/slot-menu';

const CogIcon = lucideGlyph(lucideSettings, 16);
const POPOVER_PX = 360;

// Both reach a 44px tap area on a touch screen (touch-targets.md).
const HEADER_CLASS =
  'touch-target relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10';
const FLOATING_CLASS =
  'touch-target relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SettingsCog({
  label,
  palette,
  onOpen,
  floating = false,
  keepOpenWithin,
  children,
}: {
  // The cog's name, and the popover's: "Board Settings", "Sheet Settings".
  label: string;
  palette: PlanPalette;
  onOpen?: () => void;
  // Over a card with no header of its own (a Dashboard slot's metric, utility or empty slot): a small bordered button.
  floating?: boolean;
  // What a press may land on without closing the popover (a Style row's flyout and its colour pickers).
  keepOpenWithin?: string;
  // The sections, given a way to close the popover.
  children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const slot = useSlotSettings();
  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          className={floating ? FLOATING_CLASS : HEADER_CLASS}
          style={floating ? undefined : { color: palette.muted }}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            if (anchor) return close();
            setAnchor(e.currentTarget);
            onOpen?.();
          }}
        >
          <CogIcon />
        </button>
      </Tooltip>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name={label}
          width={POPOVER_PX}
          onClose={close}
          {...(keepOpenWithin ? { keepOpenWithin } : {})}
        >
          <div
            className="flex flex-col rounded-lg border border-slate-200 bg-white py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            onPointerDown={stop}
          >
            {/* Inside a Dashboard slot, the slot's toolbar first, above the sections (slot-menu.ts). */}
            {slot?.toolbar(close)}
            {children(close)}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
