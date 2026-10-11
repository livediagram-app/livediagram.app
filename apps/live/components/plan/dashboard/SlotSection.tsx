'use client';

// A Dashboard slot's **Slot** section (docs/specs/026-plan/plan-tabs.md "Editing"), in the item's one cog: its own
// Slot Settings, or folded into the Board, Sheet or Chart Settings of what the slot shows. **Open Tab** for a slot
// showing a tab (anyone); an Editor's **Change Chart** or **Change Source** for a chart or figure from a Sheet, **Add a
// Slot** (the slot drawn small, a side to add on), then **Clear Slot** and **Remove Slot**, asking first what goes
// with it (a tab it showed, a Sheet's cells).
import { useState } from 'react';
import { Button, lucideGlyph } from '@livediagram/ui';
import {
  lucideEraser,
  lucideExternalLink,
  lucideLayoutGrid,
  lucidePencil,
  lucideTrash2,
} from '@livediagram/icons/lucide';
import type { DashboardSlot } from '@livediagram/document';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { SettingsActionTile, SettingsBody } from '../settings-panel-parts';
import { useDashboard } from './dashboard-context';
import { AddSlotSides } from './AddSlotSides';
import { SheetChartSource } from './SheetChartSource';
import { SheetMetricSource } from './SheetMetricSource';

const SlotGlyph = lucideGlyph(lucideLayoutGrid, 14);
const OpenGlyph = lucideGlyph(lucideExternalLink, 18);
const ClearGlyph = lucideGlyph(lucideEraser, 18);
const RemoveGlyph = lucideGlyph(lucideTrash2, 18);
const ChangeGlyph = lucideGlyph(lucidePencil, 18);

export interface SlotAt {
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
  const { canEdit, actions, openTab, elements, tabs, deleteTab, releaseSheets } = useDashboard();
  const [pending, setPending] = useState<'clear' | 'remove' | null>(null);
  const content = slot.content;
  const tabId = content?.type === 'tab' ? content.tabId : null;
  const el =
    content?.type === 'element'
      ? (elements.get(content.elementId) as
          | { shape?: string; planSheet?: { sheetId?: string }; chartSource?: { sheetId?: string } }
          | undefined)
      : undefined;
  const sheetId = el?.shape === 'plan-sheet' ? el.planSheet?.sheetId : undefined;
  // A Sheet Chart's own action (plan-tabs.md "Sheet Chart"): Change Chart, the picker beside its tile. A figure from a
  // Sheet's, once its source is chosen ("Figures from a Sheet"): Change Source, likewise.
  const chartSheetId = el?.chartSource?.sheetId;
  const metric = content?.type === 'sheet-metric' && content.sheetId ? content : null;
  const [changeAt, setChangeAt] = useState<HTMLElement | null>(null);
  const shownTab = tabId ? tabs.find((t) => t.id === tabId) : undefined;
  const also =
    shownTab && deleteTab
      ? {
          question: `Delete the ${shownTab.name} tab too? Kept, it stays in the tab bar.`,
          keep: 'Keep the Tab',
          remove: 'Delete the Tab Too',
        }
      : sheetId && releaseSheets
        ? {
            question: 'Delete this sheet’s cells too? Kept, they stay in this document.',
            keep: 'Keep Its Cells',
            remove: 'Delete the Sheet Too',
          }
        : null;
  const act = (which: 'clear' | 'remove') =>
    which === 'clear'
      ? actions.setSlotContent(slot.id, undefined)
      : actions.removeSlot(rowId, slot.id);
  const start = (which: 'clear' | 'remove') => {
    if (also && content) {
      setPending(which);
      return;
    }
    onClose();
    act(which);
  };
  const finish = (andMore: boolean) => {
    const which = pending;
    setPending(null);
    onClose();
    if (!which) return;
    act(which);
    if (!andMore) return;
    if (shownTab) deleteTab?.(shownTab.id);
    else if (sheetId) releaseSheets?.([sheetId]);
  };
  return (
    <BoardSettingsSection title="Slot" icon={<SlotGlyph />} open={open} onToggle={onToggle}>
      {pending && also ? (
        // What goes with the slot (plan-tabs.md "Clearing a slot"): the tab it showed, or its Sheet's cells.
        <SettingsBody>
          <div role="group" aria-label={pending === 'clear' ? 'Clear Slot' : 'Remove Slot'}>
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {pending === 'clear' ? 'Clear Slot' : 'Remove Slot'}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              {also.question}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => finish(false)}>
                {also.keep}
              </Button>
              <Button size="sm" onClick={() => finish(true)}>
                {also.remove}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </SettingsBody>
      ) : (
        <>
          {canEdit ? <AddSlotSides rowId={rowId} at={at} onAdded={onClose} /> : null}
          {tabId || canEdit ? (
            <SettingsBody>
              <div className="flex flex-wrap gap-1.5">
                {tabId ? (
                  <SettingsActionTile
                    icon={<OpenGlyph />}
                    label="Open Tab"
                    onClick={() => {
                      onClose();
                      openTab(tabId);
                    }}
                  />
                ) : null}
                {canEdit && chartSheetId !== undefined ? (
                  <SettingsActionTile
                    icon={<ChangeGlyph />}
                    label="Change Chart"
                    onClick={(e) => setChangeAt(e.currentTarget)}
                  />
                ) : null}
                {canEdit && metric ? (
                  <SettingsActionTile
                    icon={<ChangeGlyph />}
                    label="Change Source"
                    onClick={(e) => setChangeAt(e.currentTarget)}
                  />
                ) : null}
                {canEdit && content ? (
                  <SettingsActionTile
                    icon={<ClearGlyph />}
                    label="Clear Slot"
                    onClick={() => start('clear')}
                  />
                ) : null}
                {canEdit ? (
                  <SettingsActionTile
                    icon={<RemoveGlyph />}
                    label="Remove Slot"
                    onClick={() => start('remove')}
                  />
                ) : null}
              </div>
            </SettingsBody>
          ) : null}
        </>
      )}
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
