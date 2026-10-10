'use client';

// A board's own settings cog (docs/specs/026-plan/plan-board.md "The board set-up"): in its header, at the far right after Maximise,
// for someone who may edit. It opens a popover holding the same four sections as the board's element menu's Board
// (Board Setup, Swimlanes, Supported Cards, Card Layout), one open at a time, so the board is set up without the
// right-click menu. A press outside or Escape closes it, handing focus back to the cog.
import type { ShapeElement } from '@livediagram/document';
import { PlanBoardSectionsPanel } from '@/components/palette/PlanBoardMenuSection';
import type { PlanPalette } from './plan-palette';
import { SettingsCog } from './SettingsCog';
import { track } from '@/lib/telemetry';

export function BoardSettingsButton({
  element,
  palette,
}: {
  element: ShapeElement;
  palette: PlanPalette;
}) {
  return (
    <SettingsCog
      label="Board Settings"
      palette={palette}
      onOpen={() => track('Plan', 'Opened', 'BoardSettings')}
    >
      {(close) => <PlanBoardSectionsPanel element={element} onClose={close} />}
    </SettingsCog>
  );
}
