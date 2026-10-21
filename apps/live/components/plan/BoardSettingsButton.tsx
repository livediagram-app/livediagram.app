'use client';

// A board's settings cog (docs/specs/026-plan/plan-board.md "The board set-up"): in its header, at the far right after
// Maximise, for someone who may edit. It selects the board and opens its element menu under itself (the menu a
// right-click on the board opens: its Board and Cards sections, Style, Collaborate and the rest); pressed again it
// closes it.
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideSettings } from '@liveplanner/icons/lucide';
import type { ShapeElement } from '@liveplanner/document';
import { openElementMenu } from '@/hooks/canvas/element-menu-opener';
import type { PlanPalette } from './plan-palette';
import { track } from '@/lib/telemetry';

const CogIcon = lucideGlyph(lucideSettings, 16);

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardSettingsButton({
  element,
  palette,
}: {
  element: ShapeElement;
  palette: PlanPalette;
}) {
  return (
    <Tooltip label="Board Settings">
      <button
        type="button"
        aria-label="Board Settings"
        aria-haspopup="menu"
        // A menu trigger: the open menu's outside-press close leaves this press to the cog (a toggle).
        data-context-menu-trigger
        className="touch-target relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: palette.muted }}
        onPointerDown={stop}
        onContextMenu={stop}
        onClick={(e) => {
          e.stopPropagation();
          if (openElementMenu(element.id, e.currentTarget.getBoundingClientRect()))
            track('Plan', 'Opened', 'BoardSettings');
        }}
      >
        <CogIcon />
      </button>
    </Tooltip>
  );
}
