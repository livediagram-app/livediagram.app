'use client';

// The cell menu (docs/specs/029-sheets/sheet.md "Cell menu"), built from the editor's menu parts: a header naming the
// selection, the clipboard verbs as a toolbar, the comment row, then closed categories as the element menu has
// (Insert, Delete, Cells, Sort, Paste Special, Data Validation, Chart), each a side flyout of icon-left rows named for
// what they do to this selection. Someone who may only view gets
// the header and Copy alone.
import { Fragment, useState } from 'react';
import { CHART_TYPE_LABELS, CHART_TYPES } from '@liveplanner/document';
import { posRangeOf, unmergeRange } from '@liveplanner/sheets';
import { ContextMenu } from '@/components/palette/ContextMenu';
import {
  CopyIcon,
  CutIcon,
  LinkMenuIcon,
  PasteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { openHyperlink } from '@/lib/open-hyperlink';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuActionRow, MenuGroupSeparator, MenuHeader } from '@/components/primitives/PortalMenu';
import { MenuToolButton, MenuToolbar } from '@/components/primitives/MenuTiles';
import { ChartTypeIcon } from '@/components/primitives/ChartTypeIcon';
import { keyLabel } from '@/lib/key-label';
import { useSheetController } from './sheet-controller';
import { cellMenuLabels } from './sheet-cell-menu-labels';
import { SheetMergeConfirm } from './SheetMergeConfirm';
import { SheetCellCommentRow } from './SheetCellCommentRow';
import type { SheetActions } from './useSheetActions';
import { useSheetClipboard } from './useSheetClipboard';
import {
  ClearContentsIcon,
  ClearFormatIcon,
  DeleteIcon,
  FormattingIcon,
  HideIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowAboveIcon,
  InsertRowBelowIcon,
  MergeCellsIcon,
  PasteValuesIcon,
  SortAToZIcon,
  SortIcon,
  SortZToAIcon,
  UnmergeCellsIcon,
  CheckboxIcon,
  ConditionalFormatIcon,
  DropdownIcon,
  ValidationIcon,
} from './sheet-icons';

// A text glyph in a row's icon slot (the row and column header menus' arrows).
export const Glyph = ({ t }: { t: string }) => (
  <span aria-hidden className="w-4 text-center text-[13px]">
    {t}
  </span>
);

type Flyout = 'insert' | 'delete' | 'cells' | 'sort' | 'paste' | 'chart' | 'validation';

export function SheetCellMenu({
  at,
  actions,
  onClose,
}: {
  at: { x: number; y: number };
  actions: SheetActions;
  onClose: () => void;
}) {
  const c = useSheetController();
  const clip = useSheetClipboard();
  const [open, setOpen] = useState<Flyout | null>(null);
  const [askMerge, setAskMerge] = useState(false);
  const range = c.selection.ranges[c.selection.ranges.length - 1]!;
  const words = cellMenuLabels(range);
  const link = c.workbook.hyperlinkOf(c.sheet.id, c.selection.active.r, c.selection.active.c);
  const flyout = (id: Flyout) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
  });
  // Every verb runs, then the menu gets out of the way, as the element menu's do.
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const merge = () => {
    let asked = false;
    actions.merge('all', () => {
      asked = true;
      setAskMerge(true);
      return false;
    });
    if (!asked) onClose();
  };
  // Merge for a selection of more than one cell; Unmerge where it touches a merge.
  // A cheap test: building the merge would walk every cell of a large selection on each render.
  const canMerge = c.canEdit && (range.r1 !== range.r2 || range.c1 !== range.c2);
  const canUnmerge = c.canEdit && unmergeRange(c.sheet, range) !== null;
  // Remove Validation where the selection touches a rule (data-validation.md "Making and changing rules").
  const touchesRule = (c.sheet.layout.rules ?? []).some((x) => {
    const p = posRangeOf(c.sheet.layout, x);
    return p && p.r1 <= range.r2 && range.r1 <= p.r2 && p.c1 <= range.c2 && range.c1 <= p.c2;
  });
  const row = (label: string, icon: React.ReactNode, run: () => void) => (
    <MenuActionRow plain label={label} icon={icon} onClick={run} />
  );
  return (
    <ContextMenu position={at} label="Cell menu" onClose={onClose} flush>
      <MenuHeader
        title={words.title}
        aside={
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{words.count}</span>
        }
      />
      <MenuToolbar>
        {c.canEdit ? (
          <MenuToolButton
            icon={<CutIcon />}
            label="Cut"
            description={`Cut the selected cells (${keyLabel('Mod-X')}).`}
            onClick={act(() => clip.copyNow(true))}
          />
        ) : null}
        <MenuToolButton
          icon={<CopyIcon />}
          label="Copy"
          description={`Copy the selected cells (${keyLabel('Mod-C')}).`}
          onClick={act(() => clip.copyNow(false))}
        />
        {c.canEdit ? (
          <>
            <MenuToolButton
              icon={<PasteMenuIcon />}
              label="Paste"
              description={`Paste at the active cell (${keyLabel('Mod-V')}).`}
              onClick={act(() => void clip.pasteNow())}
            />
            <MenuToolButton
              icon={<PasteValuesIcon />}
              label="Paste Values"
              description={`Paste the values only: no formulas, no formats (${keyLabel('Shift-Mod-V')}).`}
              onClick={act(() => void clip.pasteSpecial('values'))}
            />
            <MenuToolButton
              icon={<ClearContentsIcon />}
              label="Clear Contents"
              description="Clear what the cells hold, keeping their formats (Delete)."
              onClick={act(() => actions.clear('inputs'))}
            />
            {/* Formats are an Editor's (sheet.md "Who may do what"). */}
            {c.canShape ? (
              <MenuToolButton
                icon={<ClearFormatIcon />}
                label="Clear Formatting"
                description="Clear the cells' formats, keeping what they hold."
                onClick={act(() => actions.clear('formats'))}
              />
            ) : null}
          </>
        ) : null}
      </MenuToolbar>
      <SheetCellCommentRow onDone={onClose} />
      {/* The active cell's HYPERLINK, for every role: the way to it without Ctrl/⌘, on a touch screen above all
          (formulas.md "Text"). */}
      {link ? (
        <MenuActionRow
          plain
          label="Open Link"
          icon={<LinkMenuIcon />}
          onClick={act(() => openHyperlink(link))}
        />
      ) : null}
      {!c.canShape ? null : askMerge ? (
        <SheetMergeConfirm
          range={range}
          onCancel={() => setAskMerge(false)}
          onMerge={act(() => {
            setAskMerge(false);
            actions.merge('all', () => true);
          })}
        />
      ) : (
        <>
          <MenuGroupSeparator />
          <MenuFlyoutSection title="Insert" icon={<InsertRowBelowIcon />} {...flyout('insert')}>
            {row(
              words.insertAbove,
              <InsertRowAboveIcon />,
              act(() => actions.insert('r', 'before')),
            )}
            {row(
              words.insertBelow,
              <InsertRowBelowIcon />,
              act(() => actions.insert('r', 'after')),
            )}
            {row(
              words.insertLeft,
              <InsertColumnLeftIcon />,
              act(() => actions.insert('c', 'before')),
            )}
            {row(
              words.insertRight,
              <InsertColumnRightIcon />,
              act(() => actions.insert('c', 'after')),
            )}
            <MenuGroupSeparator />
            {row(
              'Insert Cells, Shift Right',
              <Glyph t="→" />,
              act(() => actions.shift('insertRight')),
            )}
            {row(
              'Insert Cells, Shift Down',
              <Glyph t="↓" />,
              act(() => actions.shift('insertDown')),
            )}
          </MenuFlyoutSection>
          <MenuFlyoutSection title="Delete" icon={<DeleteIcon />} {...flyout('delete')}>
            {row(
              words.deleteRows,
              <DeleteIcon />,
              act(() => actions.remove('r')),
            )}
            {row(
              words.deleteCols,
              <DeleteIcon />,
              act(() => actions.remove('c')),
            )}
            <MenuGroupSeparator />
            {row(
              'Delete Cells, Shift Left',
              <Glyph t="←" />,
              act(() => actions.shift('deleteLeft')),
            )}
            {row(
              'Delete Cells, Shift Up',
              <Glyph t="↑" />,
              act(() => actions.shift('deleteUp')),
            )}
          </MenuFlyoutSection>
          <MenuFlyoutSection title="Cells" icon={<MergeCellsIcon />} {...flyout('cells')}>
            {canMerge ? row('Merge Cells', <MergeCellsIcon />, merge) : null}
            {canUnmerge
              ? row(
                  'Unmerge Cells',
                  <UnmergeCellsIcon />,
                  act(() => actions.unmerge()),
                )
              : null}
            {row(
              words.hideRows,
              <HideIcon />,
              act(() => actions.hide('r', true)),
            )}
            {row(
              words.hideCols,
              <HideIcon />,
              act(() => actions.hide('c', true)),
            )}
            {row(
              'Conditional Formatting…',
              <ConditionalFormatIcon />,
              act(() => actions.openFormatRules('cell')),
            )}
          </MenuFlyoutSection>
          <MenuFlyoutSection title="Sort" icon={<SortIcon />} {...flyout('sort')}>
            {/* The whole sheet by the active cell's column, as the toolbar's Sort, and named as it is there: over a
                selection, "Sort A to Z" read as sorting just the selection, and sorted a header into the data. */}
            {row(
              'Sort Sheet A to Z',
              <SortAToZIcon />,
              act(() => actions.sortColumn(true)),
            )}
            {row(
              'Sort Sheet Z to A',
              <SortZToAIcon />,
              act(() => actions.sortColumn(false)),
            )}
            {row('Custom Sort…', <SortIcon />, () => c.setMenu({ kind: 'sort' }))}
          </MenuFlyoutSection>
          <MenuFlyoutSection title="Paste Special" icon={<PasteMenuIcon />} {...flyout('paste')}>
            {row(
              'Values Only',
              <PasteValuesIcon />,
              act(() => void clip.pasteSpecial('values')),
            )}
            {row(
              'Formatting Only',
              <FormattingIcon />,
              act(() => void clip.pasteSpecial('formats')),
            )}
          </MenuFlyoutSection>
          <MenuFlyoutSection
            title="Data Validation"
            icon={<ValidationIcon />}
            {...flyout('validation')}
          >
            {row(
              'Dropdown',
              <DropdownIcon />,
              act(() => actions.openValidation('cell', { start: 'list' })),
            )}
            {row(
              'Checkbox',
              <CheckboxIcon />,
              act(() => actions.addCheckbox()),
            )}
            {row(
              'Data Validation…',
              <ValidationIcon />,
              act(() => actions.openValidation('cell')),
            )}
            {touchesRule
              ? row(
                  'Remove Validation',
                  <DeleteIcon />,
                  act(() => actions.removeValidation()),
                )
              : null}
          </MenuFlyoutSection>
          <MenuFlyoutSection
            title="Chart"
            icon={<ChartTypeIcon type="column" />}
            {...flyout('chart')}
          >
            {CHART_TYPES.map((type) => (
              <Fragment key={type}>
                {row(
                  `${CHART_TYPE_LABELS[type]} Chart`,
                  <ChartTypeIcon type={type} />,
                  act(() => actions.insertChart(type)),
                )}
              </Fragment>
            ))}
          </MenuFlyoutSection>
        </>
      )}
    </ContextMenu>
  );
}
