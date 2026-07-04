'use client';

import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ResetPositionGlyph } from '@/components/primitives/ResetPositionGlyph';

// The floating panel's header row, lifted out of MovablePanel: the
// drag handle (the whole row), the title, the caller's extra header
// content / actions, the reset-position button, and the collapse /
// minimize toggle with its plus / dash glyphs. Pure render — all the
// state stays in MovablePanel, which mounts this once per panel.
export function MovablePanelHeader({
  headerRef,
  beginDrag,
  dragging,
  title,
  headerExtra,
  headerActions,
  onReset,
  collapsible,
  effectiveCollapsed,
  dockControlledOpen,
  onMobileClose,
  onToggleCollapsed,
  onMinimize,
}: {
  headerRef: RefObject<HTMLDivElement | null>;
  beginDrag: (e: ReactPointerEvent) => void;
  dragging: boolean;
  title: string;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  onReset?: () => void;
  collapsible: boolean;
  effectiveCollapsed: boolean;
  dockControlledOpen: boolean;
  onMobileClose?: () => void;
  onToggleCollapsed: () => void;
  onMinimize?: () => void;
}) {
  return (
    <div
      ref={headerRef}
      onPointerDown={beginDrag}
      className={`flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 px-2 pb-1.5 pt-2 dark:border-slate-800 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
        {title}
      </span>
      {headerExtra ? (
        <div onPointerDown={(e) => e.stopPropagation()} className="ml-auto mr-1 flex items-center">
          {headerExtra}
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        {headerActions ? (
          <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
            {headerActions}
          </div>
        ) : null}
        {onReset ? (
          // Hidden on mobile: drag-to-move isn't available on touch
          // (the title row is repurposed as a tap-to-collapse target,
          // see beginDrag above), so a reset-position affordance has
          // nothing to reset. The button reappears on `sm:` and up
          // where dragging the title row pans the panel.
          <Tooltip title="Reset position" description="Snap back to the default corner.">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onReset}
              aria-label={`Reset ${title.toLowerCase()} position`}
              className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:flex dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {/* className="" so the glyph inherits the button's
                  currentColor (and its hover), not the fixed slate. */}
              <ResetPositionGlyph size={12} className="" />
            </button>
          </Tooltip>
        ) : null}
        <Tooltip
          title={
            collapsible
              ? effectiveCollapsed
                ? `Expand ${title.toLowerCase()}`
                : `Collapse ${title.toLowerCase()}`
              : `Minimize ${title.toLowerCase()}`
          }
          description={
            collapsible
              ? effectiveCollapsed
                ? 'Show the panel body.'
                : 'Hide the panel body, keep the banner.'
              : 'Collapse to a dock button.'
          }
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (dockControlledOpen) {
                onMobileClose?.();
                return;
              }
              if (collapsible) {
                onToggleCollapsed();
                return;
              }
              onMinimize?.();
            }}
            aria-label={
              collapsible
                ? effectiveCollapsed
                  ? `Expand ${title.toLowerCase()}`
                  : `Collapse ${title.toLowerCase()}`
                : `Minimize ${title.toLowerCase()}`
            }
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {collapsible && effectiveCollapsed ? (
              // Plus glyph: expand the body. Same 12 x 12 grid as
              // the dash so the button slot doesn't visually
              // jitter when the icon flips.
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <line
                  x1="6"
                  y1="2.5"
                  x2="6"
                  y2="9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="2.5"
                  y1="6"
                  x2="9.5"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <line
                  x1="2.5"
                  y1="6"
                  x2="9.5"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
