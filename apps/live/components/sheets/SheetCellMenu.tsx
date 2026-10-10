'use client';

// The cell menu (docs/specs/029-sheets/sheet.md "Cell menu"), shaped like the element menu: Cut, Copy and Paste as
// icon buttons along its top, then the rest in categories that open one at a time, each a list of option rows.
// Someone who may only view gets Copy alone.
import { useState, type ReactNode } from 'react';
import { OptionRows } from '@/components/plan/OptionRows';
import { ContextMenu } from '@/components/palette/ContextMenu';
import { CopyIcon, CutIcon, PasteMenuIcon } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuToolButton, MenuToolbar } from '@/components/primitives/MenuTiles';
import { useSheetController } from './sheet-controller';
import { SheetMergeConfirm } from './SheetMergeConfirm';
import type { SheetActions } from './useSheetActions';
import { useSheetClipboard } from './useSheetClipboard';
import {
  BarChartIcon,
  ClearFormatIcon,
  LineChartIcon,
  MergeIcon,
  PieChartIcon,
  SortIcon,
} from './sheet-icons';

export const Glyph = ({ t }: { t: string }) => (
  <span aria-hidden className="w-4 text-center text-[13px]">
    {t}
  </span>
);

type Section = 'insert' | 'delete' | 'paste' | 'clear' | 'cells' | 'chart';

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
  const [open, setOpen] = useState<Section | null>(null);
  const [askMerge, setAskMerge] = useState(false);
  const section = (id: Section) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
    flush: true,
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
  return (
    <ContextMenu position={at} label="Cell menu" onClose={onClose} flush>
      <MenuToolbar>
        {c.canEdit ? (
          <MenuToolButton
            icon={<CutIcon />}
            label="Cut"
            description="Cut the selected cells."
            onClick={act(() => clip.copyNow(true))}
          />
        ) : null}
        <MenuToolButton
          icon={<CopyIcon />}
          label="Copy"
          description="Copy the selected cells."
          onClick={act(() => clip.copyNow(false))}
        />
        {c.canEdit ? (
          <MenuToolButton
            icon={<PasteMenuIcon />}
            label="Paste"
            description="Paste at the active cell."
            onClick={act(() => void clip.pasteNow())}
          />
        ) : null}
      </MenuToolbar>
      {c.canShape ? (
        askMerge ? (
          <SheetMergeConfirm
            range={c.selection.ranges[c.selection.ranges.length - 1]!}
            onCancel={() => setAskMerge(false)}
            onMerge={act(() => {
              setAskMerge(false);
              actions.merge('all', () => true);
            })}
          />
        ) : (
          <>
            <MenuAccordionSection title="Insert" icon={<Glyph t="+" />} {...section('insert')}>
              <ActionRows
                rows={[
                  {
                    label: 'Row Above',
                    icon: <Glyph t="↥" />,
                    run: act(() => actions.insert('r', 'before')),
                  },
                  {
                    label: 'Column Left',
                    icon: <Glyph t="↤" />,
                    run: act(() => actions.insert('c', 'before')),
                  },
                  {
                    label: 'Cells, Shift Right',
                    icon: <Glyph t="→" />,
                    run: act(() => actions.shift('insertRight')),
                  },
                  {
                    label: 'Cells, Shift Down',
                    icon: <Glyph t="↓" />,
                    run: act(() => actions.shift('insertDown')),
                  },
                ]}
              />
            </MenuAccordionSection>
            <MenuAccordionSection title="Delete" icon={<Glyph t="−" />} {...section('delete')}>
              <ActionRows
                rows={[
                  { label: 'Row', icon: <Glyph t="⇕" />, run: act(() => actions.remove('r')) },
                  { label: 'Column', icon: <Glyph t="⇔" />, run: act(() => actions.remove('c')) },
                  {
                    label: 'Cells, Shift Left',
                    icon: <Glyph t="←" />,
                    run: act(() => actions.shift('deleteLeft')),
                  },
                  {
                    label: 'Cells, Shift Up',
                    icon: <Glyph t="↑" />,
                    run: act(() => actions.shift('deleteUp')),
                  },
                ]}
              />
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Paste Special"
              icon={<PasteMenuIcon />}
              {...section('paste')}
            >
              <ActionRows
                rows={[
                  {
                    label: 'Values Only',
                    icon: <Glyph t="1" />,
                    run: act(() => void clip.pasteSpecial('values')),
                  },
                  {
                    label: 'Formatting Only',
                    icon: <Glyph t="B" />,
                    run: act(() => void clip.pasteSpecial('formats')),
                  },
                ]}
              />
            </MenuAccordionSection>
            <MenuAccordionSection title="Clear" icon={<ClearFormatIcon />} {...section('clear')}>
              <ActionRows
                rows={[
                  {
                    label: 'Everything',
                    icon: <Glyph t="⌫" />,
                    run: act(() => actions.clear('all')),
                  },
                  {
                    label: 'Formatting',
                    icon: <ClearFormatIcon />,
                    run: act(() => actions.clear('formats')),
                  },
                ]}
              />
            </MenuAccordionSection>
            <MenuAccordionSection title="Cells" icon={<MergeIcon />} {...section('cells')}>
              <ActionRows
                rows={[
                  {
                    label: 'Sort Range…',
                    icon: <SortIcon />,
                    run: () => c.setMenu({ kind: 'sort' }),
                  },
                  { label: 'Merge Cells', icon: <MergeIcon />, run: merge },
                ]}
              />
            </MenuAccordionSection>
            <MenuAccordionSection title="Chart" icon={<BarChartIcon />} {...section('chart')}>
              <ActionRows
                rows={[
                  {
                    label: 'Bar',
                    icon: <BarChartIcon />,
                    run: act(() => actions.insertChart('bar-chart')),
                  },
                  {
                    label: 'Line',
                    icon: <LineChartIcon />,
                    run: act(() => actions.insertChart('line-chart')),
                  },
                  {
                    label: 'Pie',
                    icon: <PieChartIcon />,
                    run: act(() => actions.insertChart('pie-chart')),
                  },
                ]}
              />
            </MenuAccordionSection>
          </>
        )
      ) : null}
    </ContextMenu>
  );
}

// A section's actions as an option list (docs/specs/026-plan/plan-board.md "Option lists"): a row each, its glyph then
// its name, no marker; inside the menu they are its items.
function ActionRows({ rows }: { rows: { label: string; icon: ReactNode; run: () => void }[] }) {
  return (
    <OptionRows
      kind="action"
      label="Actions"
      className="mx-3 my-1.5"
      rows={rows.map((r) => ({ id: r.label, label: r.label, icon: r.icon }))}
      onPick={(id) => rows.find((r) => r.label === id)?.run()}
    />
  );
}
