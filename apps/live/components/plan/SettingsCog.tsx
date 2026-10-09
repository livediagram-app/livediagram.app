'use client';

// A Plan element's settings cog (a board's Board Settings, a Sheet's Sheet Settings): in its header, for someone who
// may edit, opening a popover of collapsible sections, one open at a time. A press outside or Escape closes it,
// handing focus back to the cog. Presses in it are its own, never the canvas's or the element's.
import { useState, type ReactNode } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideSettings } from '@livediagram/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import type { PlanPalette } from './plan-palette';

const CogIcon = lucideGlyph(lucideSettings, 16);
const POPOVER_PX = 360;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SettingsCog({
  label,
  palette,
  onOpen,
  children,
}: {
  // The cog's name, and the popover's: "Board Settings", "Sheet Settings".
  label: string;
  palette: PlanPalette;
  onOpen?: () => void;
  // The sections, given a way to close the popover.
  children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: palette.muted }}
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
        <AnchoredPopover anchor={anchor} name={label} width={POPOVER_PX} onClose={close}>
          <div
            className="flex flex-col rounded-lg border border-slate-200 bg-white py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            onPointerDown={stop}
          >
            {children(close)}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
