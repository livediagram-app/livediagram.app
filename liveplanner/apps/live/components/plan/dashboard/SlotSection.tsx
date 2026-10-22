'use client';

// A Dashboard slot's **Slot** section (docs/specs/026-plan/plan-tabs.md "Editing"), in the item's one cog: its own
// Slot Settings, or folded into the Board, Sheet or Chart Settings of what the slot shows. An Editor's: **Add a Slot**
// (the slot drawn small, a side to add on), then **Change Chart** or **Change Source** for a chart or figure from a
// Sheet. Open Tab, Duplicate, Clear and Remove are the cog's toolbar above its sections (SlotToolbar.tsx).
import { useState } from 'react';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideLayoutGrid, lucidePencil } from '@liveplanner/icons/lucide';
import type { DashboardSlot } from '@liveplanner/project';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { SettingsActionTile, SettingsBody } from '../settings-panel-parts';
import { useDashboard } from './dashboard-context';
import { AddSlotSides } from './AddSlotSides';
import { SheetChartSource } from './SheetChartSource';
import { SheetMetricSource } from './SheetMetricSource';

const SlotGlyph = lucideGlyph(lucideLayoutGrid, 14);
const ChangeGlyph = lucideGlyph(lucidePencil, 18);

interface SlotAt {
  // Its index in its row, its row's index, and how many slots the row has.
  slot: number;
  row: number;
  slots: number;
}

export function SlotSection({
  rowId,
  slot,
  at,
  open,
  onToggle,
  onClose,
}: {
  rowId: string;
  slot: DashboardSlot;
  at: SlotAt;
  open: boolean;
  onToggle: () => void;
  // Closes the cog's popover.
  onClose: () => void;
}) {
  const { canEdit, actions, elements } = useDashboard();
  const content = slot.content;
  const el =
    content?.type === 'element'
      ? (elements.get(content.elementId) as { chartSource?: { sheetId?: string } } | undefined)
      : undefined;
  // A Sheet Chart's own action (plan-tabs.md "Sheet Chart"): Change Chart, the picker beside its button. A figure from
  // a Sheet's, once its source is chosen ("Figures from a Sheet"): Change Source, likewise.
  const chartSheetId = el?.chartSource?.sheetId;
  const metric = content?.type === 'sheet-metric' && content.sheetId ? content : null;
  const [changeAt, setChangeAt] = useState<HTMLElement | null>(null);
  // Open Tab, Duplicate, Clear and Remove are the cog's toolbar (SlotToolbar); the section is an Editor's.
  if (!canEdit) return null;
  return (
    <BoardSettingsSection title="Slot" icon={<SlotGlyph />} open={open} onToggle={onToggle}>
      <AddSlotSides rowId={rowId} at={at} onAdded={onClose} />
      {chartSheetId !== undefined || metric ? (
        <SettingsBody>
          <div className="flex flex-wrap gap-1.5">
            {chartSheetId !== undefined ? (
              <SettingsActionTile
                icon={<ChangeGlyph />}
                label="Change Chart"
                onClick={(e) => setChangeAt(e.currentTarget)}
              />
            ) : null}
            {metric ? (
              <SettingsActionTile
                icon={<ChangeGlyph />}
                label="Change Source"
                onClick={(e) => setChangeAt(e.currentTarget)}
              />
            ) : null}
          </div>
        </SettingsBody>
      ) : null}
      {changeAt && chartSheetId !== undefined ? (
        <SheetChartSource
          anchor={changeAt}
          initialSheetId={chartSheetId}
          onChoose={(chart) => {
            actions.placeItem({ kind: 'sheet-chart', chart }, { kind: 'slot', slotId: slot.id });
            onClose();
          }}
          onClose={() => setChangeAt(null)}
        />
      ) : null}
      {changeAt && metric ? (
        <SheetMetricSource
          anchor={changeAt}
          content={metric}
          onChange={(next) => actions.setSlotContent(slot.id, next)}
          onClose={() => setChangeAt(null)}
        />
      ) : null}
    </BoardSettingsSection>
  );
}
