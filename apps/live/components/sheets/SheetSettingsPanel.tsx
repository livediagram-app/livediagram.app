'use client';

// Sheet Settings (docs/specs/029-sheets/sheet.md "Sheet Settings"): the sections of the Sheet's cog, one open at a
// time, as Board Settings: Title and Data, View, Cell Sizes, and Freeze and Totals. Its rows are the Settings
// dialog's own (a card with the label and its control, the explanation as a footnote under it), so a setting looks
// the same wherever it lives. Everything but the totals is the sheet's, seen by everyone and undoable; the totals
// pick is the viewer's own.
import { useState, type ReactNode } from 'react';
import { Button, TextInput, lucideGlyph } from '@livediagram/ui';
import {
  lucideColumns2,
  lucideEye,
  lucideFileDown,
  lucideFileUp,
  lucideLock,
  lucideSquareDashed,
  lucideRotateCcw,
  lucideTable,
  lucideTrash2,
} from '@livediagram/icons/lucide';
import {
  AXIS_SIZE_MAX,
  COLUMN_WIDTH_MIN,
  COLUMN_WIDTH_NEW,
  ROW_HEIGHT_MIN,
  ROW_HEIGHT_NEW,
  SHEET_FREEZE_COLS_MAX,
  SHEET_FREEZE_ROWS_MAX,
  SHEET_TITLE_MAX,
} from '@livediagram/sheets';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { SheetNamedRanges } from './SheetNamedRanges';
import { SigmaIcon } from './sheet-icons';
import { SettingsRow } from '@/components/dialogs/settings/SettingsRow';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import { NumberStepper } from '@/components/primitives/NumberStepper';
import { OptionRows } from '@/components/plan/OptionRows';
import { usePlan } from '@/components/plan/PlanContext';
import { FillTabArt } from '@/components/plan/plan-tile-art';
import { fillTabConfirm } from '@/components/plan/fill-tab';
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { track } from '@/lib/telemetry';
import { useSheetController } from './sheet-controller';
import { downloadSheetCsv } from './sheet-csv';
import { renameSheet } from './sheet-rename';
import { SheetArt } from './sheet-art';
import { STATS, toggleStatusPick, useStatusPick } from './sheet-status-pick';
import type { SheetActions } from './useSheetActions';

export const SHEET_FILL_TAB_HINT =
  'The sheet always fills this tab, for everyone, so the rest of the canvas can’t be used.';

const DataGlyph = lucideGlyph(lucideTable, 14);
const ViewGlyph = lucideGlyph(lucideEye, 14);
const SizeGlyph = lucideGlyph(lucideColumns2, 14);
const FreezeGlyph = lucideGlyph(lucideLock, 14);
const NamesGlyph = lucideGlyph(lucideSquareDashed, 14);
const ImportGlyph = lucideGlyph(lucideFileUp, 18);
const DownloadGlyph = lucideGlyph(lucideFileDown, 18);
const ClearGlyph = lucideGlyph(lucideTrash2, 18);
const ResetGlyph = lucideGlyph(lucideRotateCcw, 12);

type Section = 'data' | 'view' | 'sizes' | 'freeze' | 'calc' | 'names';

// A Settings dialog row's presentational half.
const row = (key: string, label: string, description: string) => ({
  key: `sheet-${key}`,
  label,
  description,
});

const Body = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-3 px-3 pb-3 pt-1">{children}</div>
);

// A tile for a one-press action (Import CSV…, Download CSV, Clear Sheet), as the element menu's tiles.
function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
    >
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}

export function SheetSettingsPanel({
  elementId,
  actions,
  onImportCsv,
  onClose,
}: {
  // The Sheet element (its Fill Tab).
  elementId?: string;
  actions: SheetActions;
  onImportCsv: () => void;
  onClose: () => void;
}) {
  const c = useSheetController();
  const plan = usePlan();
  const confirm = useConfirm();
  const filled = useFillsTab(elementId ?? '');
  // Fill Tab (sheet.md "Fill Tab"): as a board's, turning it on deletes the rest of the canvas, asked first.
  const setFill = async (on: boolean) => {
    if (!plan || !elementId || on === filled) return;
    if (on) {
      const others = plan.tabOthers(elementId);
      if (others.count > 0) {
        onClose();
        if (!(await confirm(fillTabConfirm(c.sheet.title, others)))) return;
      }
    }
    track('Plan', 'Toggled', on ? 'SheetFillTabOn' : 'SheetFillTabOff');
    plan.fillTabSheet(elementId, on);
  };
  const layout = c.sheet.layout;
  const [open, setOpen] = useState<Section | null>('data');
  const [title, setTitle] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const pick = useStatusPick();
  const section = (id: Section) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
  });
  const saveTitle = () => {
    if (title === null) return;
    renameSheet(c, title);
    setTitle(null);
  };
  const sized = layout.colWidth !== undefined || layout.rowHeight !== undefined;
  return (
    <>
      <BoardSettingsSection title="Sheet Setup" icon={<DataGlyph />} {...section('data')}>
        <Body>
          <label className="flex flex-col gap-1.5">
            <span className="px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              Title
            </span>
            <TextInput
              disabled={!c.canShape}
              aria-label="Title"
              maxLength={SHEET_TITLE_MAX}
              value={title ?? c.sheet.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') saveTitle();
              }}
            />
          </label>
          {confirmClear ? (
            <div
              role="alertdialog"
              aria-label="Clear Sheet"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <p>
                Start {c.sheet.title} over? Every cell, format and setting goes, and Setup Sheet
                shows again. You can undo this.
              </p>
              <div className="mt-2.5 flex justify-end gap-2">
                <Button variant="ghost" size="xs" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    setConfirmClear(false);
                    actions.clearSheet();
                    onClose();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {c.canShape ? (
                <ActionTile
                  icon={<ImportGlyph />}
                  label="Import CSV…"
                  onClick={() => {
                    onClose();
                    onImportCsv();
                  }}
                />
              ) : null}
              {/* An empty sheet can be set up again (sheet.md "Setup Sheet"): its card takes the grid's place. */}
              {c.canShape && c.sheet.cells.size === 0 ? (
                <ActionTile
                  icon={<SheetArt size={18} />}
                  label="Setup Sheet"
                  onClick={() => {
                    onClose();
                    c.store.write(
                      c.sheet.id,
                      { kind: 'layout', changes: [{ k: 'options', setupPending: true }] },
                      { undoable: false },
                    );
                  }}
                />
              ) : null}
              <ActionTile
                icon={<DownloadGlyph />}
                label="Download CSV"
                onClick={() => downloadSheetCsv(c.workbook, c.sheet)}
              />
              {c.canShape && c.sheet.cells.size > 0 ? (
                <ActionTile
                  icon={<ClearGlyph />}
                  label="Clear Sheet"
                  onClick={() => setConfirmClear(true)}
                />
              ) : null}
            </div>
          )}
        </Body>
      </BoardSettingsSection>
      {c.canShape ? (
        <>
          <BoardSettingsSection title="Sheet Options" icon={<ViewGlyph />} {...section('view')}>
            <Body>
              <SettingsRow
                row={row('grid', 'Gridlines', 'The lines between the cells, for everyone.')}
                checked={layout.showGrid !== false}
                onChange={(on) => actions.setOptions({ showGrid: on })}
              />
              <SettingsRow
                row={row(
                  'headers',
                  'Row and Column Headers',
                  'The row numbers down the left and the column letters along the top.',
                )}
                checked={layout.showHeaders !== false}
                onChange={(on) => actions.setOptions({ showHeaders: on })}
              />
              {plan && elementId ? (
                <div className="flex flex-col gap-1.5">
                  <span className="px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    Fill Tab
                  </span>
                  <OptionRows
                    kind="single"
                    label="Fill Tab"
                    selected={filled ? 'fill' : 'canvas'}
                    rows={[
                      { id: 'canvas', label: 'On Canvas', icon: <FillTabArt fill={false} /> },
                      { id: 'fill', label: 'Fill Tab', icon: <FillTabArt fill /> },
                    ]}
                    onPick={(id) => void setFill(id === 'fill')}
                  />
                  <p className="px-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {SHEET_FILL_TAB_HINT}
                  </p>
                </div>
              ) : null}
            </Body>
          </BoardSettingsSection>
          <BoardSettingsSection title="Cells" icon={<SizeGlyph />} {...section('sizes')}>
            <Body>
              <div className="flex flex-col gap-2">
                <SettingsRowShell
                  row={row('col-width', 'Column Width', '')}
                  control={
                    <NumberStepper
                      label="Column Width"
                      unit="px"
                      step={10}
                      value={layout.colWidth ?? COLUMN_WIDTH_NEW}
                      min={COLUMN_WIDTH_MIN}
                      max={AXIS_SIZE_MAX}
                      onCommit={(n) =>
                        actions.setOptions({ colWidth: n === COLUMN_WIDTH_NEW ? null : n })
                      }
                    />
                  }
                />
                <SettingsRowShell
                  row={row(
                    'row-height',
                    'Row Height',
                    'For every column and row not sized on its own; ones you have dragged keep their size.',
                  )}
                  control={
                    <NumberStepper
                      label="Row Height"
                      unit="px"
                      step={2}
                      value={layout.rowHeight ?? ROW_HEIGHT_NEW}
                      min={ROW_HEIGHT_MIN}
                      max={AXIS_SIZE_MAX}
                      onCommit={(n) =>
                        actions.setOptions({ rowHeight: n === ROW_HEIGHT_NEW ? null : n })
                      }
                    />
                  }
                />
              </div>
              {sized ? (
                <button
                  type="button"
                  onClick={() => actions.setOptions({ colWidth: null, rowHeight: null })}
                  className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ResetGlyph />
                  Reset to Default
                </button>
              ) : null}
            </Body>
          </BoardSettingsSection>
        </>
      ) : null}
      {/* Freeze changes the sheet: someone who may only view does not see it. */}
      {c.canShape ? (
        <BoardSettingsSection title="Freeze" icon={<FreezeGlyph />} {...section('freeze')}>
          <Body>
            <div className="flex flex-col gap-2">
              <SettingsRowShell
                row={row('frozen-rows', 'Frozen Rows', '')}
                control={
                  <NumberStepper
                    label="Frozen Rows"
                    value={layout.frozenRows ?? 0}
                    min={0}
                    max={Math.min(SHEET_FREEZE_ROWS_MAX, layout.rows.length - 1)}
                    onCommit={(n) => actions.freeze(n)}
                  />
                }
              />
              <SettingsRowShell
                row={row(
                  'frozen-cols',
                  'Frozen Columns',
                  'They stay in place while the rest of the sheet scrolls.',
                )}
                control={
                  <NumberStepper
                    label="Frozen Columns"
                    value={layout.frozenCols ?? 0}
                    min={0}
                    max={Math.min(SHEET_FREEZE_COLS_MAX, layout.cols.length - 1)}
                    onCommit={(n) => actions.freeze(undefined, n)}
                  />
                }
              />
            </div>
          </Body>
        </BoardSettingsSection>
      ) : null}
      <BoardSettingsSection title="Calculations" icon={<SigmaIcon />} {...section('calc')}>
        <Body>
          <div className="flex flex-col gap-1.5">
            <span className="px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              Totals
            </span>
            <OptionRows
              kind="multiple"
              label="Totals"
              selected={pick}
              onPick={(stat) => toggleStatusPick(stat as (typeof STATS)[number])}
              rows={STATS.map((stat) => ({
                id: stat,
                label: stat,
                // The last one shown stays.
                disabled: pick.length === 1 && pick.includes(stat),
              }))}
            />
            <p className="px-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Shown under a selection of numbers. Your own choice, on every sheet.
            </p>
          </div>
        </Body>
      </BoardSettingsSection>
      <BoardSettingsSection title="Named Ranges" icon={<NamesGlyph />} {...section('names')}>
        <Body>
          <SheetNamedRanges actions={actions} onClose={onClose} />
        </Body>
      </BoardSettingsSection>
    </>
  );
}
