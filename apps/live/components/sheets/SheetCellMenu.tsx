'use client';

// The cell menu (docs/specs/029-sheets/sheet.md "Cell menu"), built from the editor's menu parts as the Explorer's
// document menu is: a header naming the selection, the clipboard verbs as a toolbar, then icon-left rows in groups,
// each named for what it does to this selection, with the rarer verbs in side flyouts. Someone who may only view gets
// the header and Copy alone.
import { useState } from 'react';
import { unmergeRange } from '@livediagram/sheets';
import { ContextMenu } from '@/components/palette/ContextMenu';
import { CopyIcon, CutIcon, PasteMenuIcon } from '@/components/palette/context-menu-icons';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuActionRow, MenuGroupSeparator, MenuHeader } from '@/components/primitives/PortalMenu';
import { MenuToolButton, MenuToolbar } from '@/components/primitives/MenuTiles';
import { keyLabel } from '@/lib/key-label';
import { useSheetController } from './sheet-controller';
import { cellMenuLabels } from './sheet-cell-menu-labels';
import { SheetMergeConfirm } from './SheetMergeConfirm';
import type { SheetActions } from './useSheetActions';
import { useSheetClipboard } from './useSheetClipboard';
import {
  BarChartIcon,
  ClearContentsIcon,
  ClearFormatIcon,
  DeleteIcon,
  FormattingIcon,
  HideIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowAboveIcon,
  InsertRowBelowIcon,
  LineChartIcon,
  MergeCellsIcon,
  PasteValuesIcon,
  PieChartIcon,
  SortAToZIcon,
  SortIcon,
  SortZToAIcon,
  UnmergeCellsIcon,
} from './sheet-icons';

// A text glyph in a row's icon slot (the row and column header menus' arrows).
export const Glyph = ({ t }: { t: string }) => (
  <span aria-hidden className="w-4 text-center text-[13px]">
    {t}
  </span>
);

type Flyout = 'sort' | 'shift' | 'hide' | 'paste' | 'chart';

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
  const flyout = (id: Flyout) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
    plain: true,
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
  const row = (label: string, icon: React.ReactNode, run: () => void) => (
    <MenuActionRow plain label={label} icon={icon} onClick={run} />
  );
  return (
    <ContextMenu position={at} label="Cell menu" onClose={onClose} flush>
      <MenuHeader
        title={words.title}
        aside={<span className="text-[11px] text-slate-400">{words.count}</span>}
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
            <MenuToolButton
              icon={<ClearFormatIcon />}
              label="Clear Formatting"
              description="Clear the cells' formats, keeping what they hold."
              onClick={act(() => actions.clear('formats'))}
            />
          </>
        ) : null}
      </MenuToolbar>
      {!c.canEdit ? null : askMerge ? (
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
            words.deleteRows,
            <DeleteIcon />,
            act(() => actions.remove('r')),
          )}
          {row(
            words.deleteCols,
            <DeleteIcon />,
            act(() => actions.remove('c')),
          )}
          {canMerge ? row('Merge Cells', <MergeCellsIcon />, merge) : null}
          {canUnmerge
            ? row(
                'Unmerge Cells',
                <UnmergeCellsIcon />,
                act(() => actions.unmerge()),
              )
            : null}
          <MenuGroupSeparator />
          <MenuFlyoutSection title="Sort" icon={<SortIcon />} {...flyout('sort')}>
            {row(
              'Sort A to Z',
              <SortAToZIcon />,
              act(() => actions.sortColumn(true)),
            )}
            {row(
              'Sort Z to A',
              <SortZToAIcon />,
              act(() => actions.sortColumn(false)),
            )}
            {row('Custom Sort…', <SortIcon />, () => c.setMenu({ kind: 'sort' }))}
          </MenuFlyoutSection>
          <MenuFlyoutSection
            title="Shift Cells"
            icon={<InsertColumnRightIcon />}
            {...flyout('shift')}
          >
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
          <MenuFlyoutSection title="Hide" icon={<HideIcon />} {...flyout('hide')}>
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
          <MenuFlyoutSection title="Insert Chart" icon={<BarChartIcon />} {...flyout('chart')}>
            {row(
              'Bar Chart',
              <BarChartIcon />,
              act(() => actions.insertChart('bar-chart')),
            )}
            {row(
              'Line Chart',
              <LineChartIcon />,
              act(() => actions.insertChart('line-chart')),
            )}
            {row(
              'Pie Chart',
              <PieChartIcon />,
              act(() => actions.insertChart('pie-chart')),
            )}
          </MenuFlyoutSection>
        </>
      )}
    </ContextMenu>
  );
}
