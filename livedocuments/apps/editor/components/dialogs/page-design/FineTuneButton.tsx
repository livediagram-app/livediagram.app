'use client';

// Page Design's Fine Tune (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): a full-width row pinned to
// the foot of the screen, as the layers' rows are, that opens the worn design's controls beside the dialog, or as a drawer on a phone, so the
// layers and their pickers keep the dialog's room (owner, 2026-11-25).
import { useState, type ReactNode } from 'react';
import { lucideChevronRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { PhoneDrawer } from '@liveworkspace/workbench/components/primitives/PhoneDrawer';
import { CELL, CELL_THUMB, KICK, ROW, THUMB } from './PageDesignLayers';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';

const Chevron = lucideGlyph(lucideChevronRight, 14);
const WIDTH = 360;
// Pickers the controls open (a colour picker, a select's list), portalled elsewhere: a press in one is not outside.
const KEEP_OPEN =
  '[role="menu"], [role="listbox"], [role="dialog"][data-colour-picker], [data-colour-picker]';

// Three sliders, the knobs at different stops.
function TuneArt() {
  return (
    <svg viewBox="0 0 40 24" className="h-6 w-10" fill="none" aria-hidden="true">
      {[5, 12, 19].map((y, i) => (
        <g key={y}>
          <path
            d={`M4 ${y}h32`}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx={[26, 12, 20][i]} cy={y} r="3" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export function FineTuneButton({
  title,
  onReset,
  footer,
  cell = false,
  children,
}: {
  title: string;
  // Reset, in the header: the design's own defaults again.
  onReset: () => void;
  // Pinned under the controls (Save This Design).
  footer?: ReactNode;
  // A card of the home's grid (right of Finish), else a row of a pinned foot (the Design picker).
  cell?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // The button as state, not a ref: the popover anchors to it while rendering.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const phone = useIsMobileViewport();
  const close = () => setOpen(false);
  // Beside the dialog it draws its own surface (the popover paints one only with a pointer); the drawer has its own.
  const body = (
    <div
      className={`flex min-h-0 flex-col ${phone ? '' : 'rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}
      data-page-design-fine-tune=""
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 py-2.5 pl-4 pr-2.5 dark:border-slate-800">
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Fine Tune{' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">· {title}</span>
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          data-page-design-tune-reset=""
        >
          Reset
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          {footer}
        </div>
      ) : null}
    </div>
  );
  // A full-width row, as the layers' rows are, in the screen's pinned foot (PageDesignPanel).
  return (
    <>
      <button
        ref={setButton}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`${cell ? CELL : ROW} ${open ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
        data-page-design-fine-tune-button=""
      >
        <span
          className={`${cell ? CELL_THUMB : THUMB} flex items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300`}
        >
          <TuneArt />
        </span>
        <span className="min-w-0">
          <span className={KICK}>Fine Tune</span>
          <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
        </span>
        <Chevron className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </button>{' '}
      {open && button ? (
        phone ? (
          <PhoneDrawer name={`Fine Tune, ${title}`} layer="modal" onClose={close}>
            {body}
          </PhoneDrawer>
        ) : (
          <AnchoredPopover
            anchor={button}
            beside={button.closest<HTMLElement>('[role="dialog"]')}
            name={`Fine Tune, ${title}`}
            width={WIDTH}
            layer="modal"
            keepOpenWithin={`${KEEP_OPEN}, [data-page-design-fine-tune-button]`}
            onClose={close}
          >
            {body}
          </AnchoredPopover>
        )
      ) : null}
    </>
  );
}
