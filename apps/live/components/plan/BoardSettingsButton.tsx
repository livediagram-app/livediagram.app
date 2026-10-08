'use client';

// A board's own settings cog (docs/specs/026-plan/plan-board.md "The board set-up"): in its header, left of Maximise,
// for someone who may edit. It opens a popover holding the same four sections as the board's element menu's Board
// (Board Title, Board Swimlanes, Supported Cards, Card Layout), one open at a time, so the board is set up without the
// right-click menu. A press outside or
// Escape closes it, handing focus back to the cog.
import { useState } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideSettings } from '@livediagram/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { PlanBoardSectionsPanel } from '@/components/palette/PlanBoardMenuSection';
import type { PlanPalette } from './plan-palette';
import { track } from '@/lib/telemetry';

const CogIcon = lucideGlyph(lucideSettings, 16);
const POPOVER_PX = 360;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardSettingsButton({
  element,
  palette,
}: {
  element: ShapeElement;
  palette: PlanPalette;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip label="Board Settings">
        <button
          type="button"
          aria-label="Board Settings"
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: palette.muted }}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            if (anchor) {
              setAnchor(null);
              return;
            }
            setAnchor(e.currentTarget);
            track('Plan', 'Opened', 'BoardSettings');
          }}
        >
          <CogIcon />
        </button>
      </Tooltip>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Board Settings"
          width={POPOVER_PX}
          onClose={() => setAnchor(null)}
        >
          <div
            className="flex flex-col rounded-lg border border-slate-200 bg-white py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            // A press in the settings is the popover's, never the canvas's or the board's.
            onPointerDown={stop}
          >
            <PlanBoardSectionsPanel element={element} />
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
