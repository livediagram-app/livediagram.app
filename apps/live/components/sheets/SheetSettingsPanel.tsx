'use client';

// Sheet Settings (docs/specs/029-sheets/sheet.md "Sheet Settings"): the sections of the Sheet's cog, one open at a
// time, as Board Settings: Title and Data, View, Cell Sizes, and Freeze and Totals. Its rows are the Settings
// dialog's own (a card with the label and its control, the explanation as a footnote under it), so a setting looks
// the same wherever it lives. Everything but the totals is the sheet's, seen by everyone and undoable; the totals
// pick is the viewer's own.
import { useState, type ReactNode } from 'react';
import { TextInput, lucideGlyph } from '@livediagram/ui';
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
  cellSizeDefaults,
  cellSizeOf,
  type SheetCellSize,
} from '@livediagram/sheets';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { SheetNamedRanges } from './SheetNamedRanges';
import { SheetFormatRuleList, SheetValidationRules } from './rules/SheetRuleSettings';
import { ConditionalFormatIcon, ValidationIcon } from './sheet-icons';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { SigmaIcon } from './sheet-icons';
import { SettingsRow } from '@/components/dialogs/settings/SettingsRow';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import { NumberStepper } from '@/components/primitives/NumberStepper';
import { OptionRows } from '@/components/plan/OptionRows';
import {
  SettingsActionTile,
  SettingsBody,
  SettingsField,
} from '@/components/plan/settings-panel-parts';
import { CELL_SIZE_OPTIONS } from './sheet-cell-sizes';
import { useSheetController } from './sheet-controller';
import { downloadSheetCsv } from './sheet-csv';
import { renameSheet } from './sheet-rename';
import { SheetArt } from './sheet-art';
import { STATS, toggleStatusPick, useStatusPick } from './sheet-status-pick';
import type { SheetActions } from './useSheetActions';

const DataGlyph = lucideGlyph(lucideTable, 14);
const ViewGlyph = lucideGlyph(lucideEye, 14);
const SizeGlyph = lucideGlyph(lucideColumns2, 14);
const FreezeGlyph = lucideGlyph(lucideLock, 14);
const NamesGlyph = lucideGlyph(lucideSquareDashed, 14);
const ImportGlyph = lucideGlyph(lucideFileUp, 18);
const DownloadGlyph = lucideGlyph(lucideFileDown, 18);
const ClearGlyph = lucideGlyph(lucideTrash2, 18);
const ResetGlyph = lucideGlyph(lucideRotateCcw, 12);

type Section = 'data' | 'view' | 'sizes' | 'freeze' | 'calc' | 'names' | 'validation' | 'formats';

// A Settings dialog row's presentational half.
const row = (key: string, label: string, description: string) => ({
  key: `sheet-${key}`,
  label,
  description,
});

export function SheetSettingsPanel({
  actions,
  onImportCsv,
  onClose,
  csvInTabMenu = false,
  more,
}: {
  actions: SheetActions;
  onImportCsv: () => void;
  onClose: () => void;
  // A Sheet filling its Sheet tab: Import CSV and Download CSV are the tab menu's (tab-data-rows.ts), not repeated here.
  csvInTabMenu?: boolean;
  // Sections after the Sheet's own, sharing its one-open-at-a-time (a Dashboard slot's Slot section).
  more?:
    ((section: (id: string) => { open: boolean; onToggle: () => void }) => ReactNode) | undefined;
}) {
  const c = useSheetController();
  const layout = c.sheet.layout;
  const [open, setOpen] = useState<string | null>('data');
  const [title, setTitle] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<HTMLElement | null>(null);
  const pick = useStatusPick();
  const section = (id: Section | string) => ({
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
        <SettingsBody>
          <SettingsField label="Title">
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
          </SettingsField>
          {
            <div className="flex flex-wrap gap-1.5">
              {c.canShape && !csvInTabMenu ? (
                <SettingsActionTile
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
                <SettingsActionTile
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
              {csvInTabMenu ? null : (
                <SettingsActionTile
                  icon={<DownloadGlyph />}
                  label="Download CSV"
                  onClick={() => downloadSheetCsv(c.workbook, c.sheet)}
                />
              )}
              {c.canShape && c.sheet.cells.size > 0 ? (
                <SettingsActionTile
                  icon={<ClearGlyph />}
                  label="Clear Sheet"
                  onClick={(e) => setConfirmClear(e.currentTarget)}
                />
              ) : null}
            </div>
          }
          {/* Clearing asks first, beside its tile (the shared ConfirmPopover). */}
          {confirmClear ? (
            <ConfirmPopover
              anchor={confirmClear}
              message={`Start ${c.sheet.title} over? Every cell, chart, format and setting goes, and Setup Sheet shows again. You can undo this.`}
              confirmLabel="Clear"
              onConfirm={() => {
                setConfirmClear(null);
                actions.clearSheet();
                onClose();
              }}
              onCancel={() => setConfirmClear(null)}
            />
          ) : null}
        </SettingsBody>
      </BoardSettingsSection>
      {c.canShape ? (
        <>
          <BoardSettingsSection title="Sheet Options" icon={<ViewGlyph />} {...section('view')}>
            <SettingsBody>
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
            </SettingsBody>
          </BoardSettingsSection>
          <BoardSettingsSection title="Cells" icon={<SizeGlyph />} {...section('sizes')}>
            <SettingsBody>
              {/* Setup Sheet's sizes: a pick sets both defaults at once; none is chosen once they are set by hand. */}
              <OptionRows
                kind="single"
                label="Cell Size"
                palette={c.palette}
                selected={cellSizeOf(layout)}
                onPick={(id) => actions.setOptions(cellSizeDefaults(id as SheetCellSize))}
                rows={CELL_SIZE_OPTIONS.map((x) => ({ id: x.id, label: x.label, detail: x.hint }))}
              />
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
            </SettingsBody>
          </BoardSettingsSection>
        </>
      ) : null}
      {/* Freeze changes the sheet: someone who may only view does not see it. */}
      {c.canShape ? (
        <BoardSettingsSection title="Freeze" icon={<FreezeGlyph />} {...section('freeze')}>
          <SettingsBody>
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
          </SettingsBody>
        </BoardSettingsSection>
      ) : null}
      <BoardSettingsSection title="Calculations" icon={<SigmaIcon />} {...section('calc')}>
        <SettingsBody>
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
        </SettingsBody>
      </BoardSettingsSection>
      <BoardSettingsSection title="Named Ranges" icon={<NamesGlyph />} {...section('names')}>
        <SettingsBody>
          <SheetNamedRanges actions={actions} onClose={onClose} />
        </SettingsBody>
      </BoardSettingsSection>
      <BoardSettingsSection
        title="Data Validation"
        icon={<ValidationIcon />}
        {...section('validation')}
      >
        <SettingsBody>
          <SheetValidationRules actions={actions} onClose={onClose} />
        </SettingsBody>
      </BoardSettingsSection>
      <BoardSettingsSection
        title="Conditional Formatting"
        icon={<ConditionalFormatIcon />}
        {...section('formats')}
      >
        <SettingsBody>
          <SheetFormatRuleList actions={actions} onClose={onClose} />
        </SettingsBody>
      </BoardSettingsSection>
      {more?.(section)}
    </>
  );
}
