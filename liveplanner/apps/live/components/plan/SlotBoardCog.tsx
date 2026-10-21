'use client';

// A board's cog in a Dashboard slot (docs/specs/026-plan/plan-board.md "Board Settings cog"): a dashboard opens no
// element menu, so the cog opens **Board Settings** as a popover (as a Sheet's and a chart's do), the element menu's
// four board sections, then the slot's **Slot** section (slot-menu.ts), one open at a time.
import type { ShapeElement } from '@liveplanner/document';
import { PlanBoardSectionsPanel } from '@/components/palette/PlanBoardMenuSection';
import { track } from '@/lib/telemetry';
import { SettingsCog } from './SettingsCog';
import { SLOT_KEEP_OPEN, type SlotSettingsValue } from './dashboard/slot-menu';
import type { PlanPalette } from './plan-palette';

export function SlotBoardCog({
  element,
  palette,
  slot,
}: {
  element: ShapeElement;
  palette: PlanPalette;
  slot: SlotSettingsValue;
}) {
  return (
    <SettingsCog
      label="Board Settings"
      palette={palette}
      keepOpenWithin={SLOT_KEEP_OPEN}
      onOpen={() => track('Plan', 'Opened', 'BoardSettings')}
    >
      {(close) => (
        <PlanBoardSectionsPanel
          element={element}
          onClose={close}
          more={(section) => slot.sections(section, close)}
        />
      )}
    </SettingsCog>
  );
}
