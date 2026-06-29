'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { GearIcon } from '@/components/chrome/tab-bar-icons';
import { ResetPositionGlyph } from '@/components/primitives/ResetPositionGlyph';
import { useClickOutside } from '@/hooks/ui/useClickOutside';
import { useEscape } from '@/hooks/ui/useEscape';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

const GAP = 8; // space between the trigger and the popover

// A gear button that opens a small, portal-rendered settings popover anchored
// under it (right-aligned, clamped on-screen) and dismissed on outside-click or
// Escape. Extracted from the Palette / Map / AI panel gear popovers (spec/20,
// /25, /59), which were byte-identical bar the label, width, trigger data-attr,
// and body. Portal-rendered so a panel's overflow / stacking context can't clip
// it. `children` is a render prop receiving `close`, so a body action (e.g.
// Reset position) can dismiss the popover after firing.
export function SettingsPopover({
  label,
  description,
  triggerAttr,
  width,
  children,
}: {
  // Names the control: drives the tooltip title + aria-labels ("<label> settings").
  label: string;
  // Tooltip body shown under the title.
  description: string;
  // Per-instance trigger marker (e.g. 'data-map-settings-trigger'). The
  // outside-click guard whitelists this exact selector so the gear's own click
  // toggles the popover instead of racing the dismissal. Keep it unique per
  // popover so opening one still closes another.
  triggerAttr: string;
  width: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      // Right-align under the trigger, then clamp the left edge on-screen.
      const left = Math.max(EDGE, Math.min(t.right - width, window.innerWidth - width - EDGE));
      setPos({ left, top: t.bottom + GAP });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, width]);

  useClickOutside(panelRef, () => setOpen(false), open, `[${triggerAttr}]`);
  useEscape(() => setOpen(false), { enabled: open });

  const title = `${label} settings`;
  return (
    <>
      <Tooltip title={title} description={description}>
        <button
          ref={triggerRef}
          type="button"
          {...{ [triggerAttr]: '' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen((v) => !v)}
          aria-label={title}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex h-5 w-5 items-center justify-center rounded transition ${
            open
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          }`}
        >
          <GearIcon />
        </button>
      </Tooltip>
      {open ? (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[var(--z-overlay)] flex animate-fade-in flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
          >
            {children(() => setOpen(false))}
          </div>
        </Portal>
      ) : null}
    </>
  );
}

// The divider + "Reset position" row shared by the panel settings popovers:
// snap the panel back to its default corner, greyed out (and inert) when it's
// already there. Pass the `close` from SettingsPopover so it dismisses after.
export function SettingsPopoverResetRow({
  onReset,
  resettable,
  onClose,
}: {
  onReset: () => void;
  resettable: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      <button
        type="button"
        disabled={!resettable}
        onClick={() => {
          onReset();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:hover:bg-transparent"
      >
        <ResetPositionGlyph />
        <span className="flex flex-col">
          <span>Reset position</span>
          <span className="text-[10px] font-normal leading-snug text-slate-400 dark:text-slate-500">
            {resettable ? 'Snap back to the default corner.' : 'Already at the default corner.'}
          </span>
        </span>
      </button>
    </>
  );
}
