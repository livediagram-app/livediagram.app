'use client';

// The toolbar's menus (docs/specs/029-sheets/sheet.md "Toolbar", "Formatting", "Freeze"): icon-left rows in the shared
// PortalMenu, the colour ones with the shared colour row (theme swatches, your colours, a custom colour).
import { BORDER_LINES, SheetBordersPicker, type BorderLine } from './SheetBordersPicker';
import { useState } from 'react';
import { FONTS } from '@livediagram/document';
import {
  FONT_SIZE_DEFAULT,
  formatRange,
  FONT_SIZES,
  type FunctionFamily,
  type NumberFormatKind,
} from '@livediagram/sheets';
import { SheetMergeConfirm } from './SheetMergeConfirm';
import { SheetFunctionMenu } from './SheetFunctionMenu';
import { MenuActionRow, PortalMenu } from '@/components/primitives/PortalMenu';
import { ColourRow } from '@/components/palette/context-menu-input-rows';
import { useColourPalette } from '@/hooks/ui/useColourPalette';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import {
  CheckMark as Check,
  FillColourIcon,
  MergeIcon,
  SortIcon,
  TextColourIcon,
  WrapIcon,
} from './sheet-icons';
import { SheetFreezeRows } from './SheetFreezeRows';

export type ToolbarMenuKind =
  | 'number'
  | 'text-colour'
  | 'fill-colour'
  | 'font'
  | 'font-size'
  | 'borders'
  | 'merge'
  | 'wrap'
  | 'sort'
  | 'freeze'
  | 'more'
  // A family of functions (SheetFunctionMenu).
  | `fn:${FunctionFamily}`;

const NUMBER_ROWS: { label: string; nf: NumberFormatKind; cur?: string }[] = [
  { label: 'Automatic', nf: 'auto' },
  { label: 'Number', nf: 'number' },
  { label: 'Percent', nf: 'percent' },
  { label: 'Currency (£)', nf: 'currency', cur: '£' },
  { label: 'Currency ($)', nf: 'currency', cur: '$' },
  { label: 'Currency (€)', nf: 'currency', cur: '€' },
  { label: 'Accounting', nf: 'accounting' },
  { label: 'Scientific', nf: 'scientific' },
  { label: 'Date', nf: 'date' },
  { label: 'Time', nf: 'time' },
  { label: 'Date Time', nf: 'datetime' },
  { label: 'Duration', nf: 'duration' },
  { label: 'Plain Text', nf: 'text' },
];

// The border style last picked, kept for the session as Sheets keeps it.
let lastLine: BorderLine = BORDER_LINES[0]!;

type FoldedButton = {
  label: string;
  icon: React.ReactNode;
  run?: () => void;
  menu?: ToolbarMenuKind;
};

export function SheetToolbarMenu({
  kind,
  anchor,
  actions,
  folded,
  onOpen,
  onClose,
}: {
  kind: ToolbarMenuKind;
  anchor: HTMLElement;
  actions: SheetActions;
  folded: FoldedButton[];
  onOpen: (kind: ToolbarMenuKind, anchor: HTMLElement) => void;
  onClose: () => void;
}) {
  const c = useSheetController();
  const { swatches } = useColourPalette();
  const [mergeAsk, setMergeAsk] = useState<'all' | 'across' | null>(null);
  const [line, setLine] = useState(lastLine);
  const f = actions.activeFormat();
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const range = c.selection.ranges[c.selection.ranges.length - 1]!;
  // Merge, asking here first when it would clear values.
  const merge = (mode: 'all' | 'across') => {
    let asked = false;
    actions.merge(mode, () => {
      asked = true;
      setMergeAsk(mode);
      return false;
    });
    if (!asked) onClose();
  };

  if (kind === 'text-colour' || kind === 'fill-colour') {
    const text = kind === 'text-colour';
    return (
      <PortalMenu
        anchor={anchor}
        onClose={onClose}
        surface="control"
        label={text ? 'Text Colour' : 'Fill Colour'}
      >
        <ColourRow
          label={text ? 'Text' : 'Fill'}
          icon={text ? <TextColourIcon /> : <FillColourIcon />}
          value={(text ? f?.fc : f?.bg) ?? (text ? c.palette.text : 'transparent')}
          open
          onToggle={onClose}
          onChange={(colour) =>
            actions.format(
              text
                ? { fc: colour === 'transparent' ? null : colour }
                : { bg: colour === 'transparent' ? null : colour },
            )
          }
          onCommit={(colour) => {
            actions.format(
              text
                ? { fc: colour === 'transparent' ? null : colour }
                : { bg: colour === 'transparent' ? null : colour },
            );
            onClose();
          }}
          {...swatches}
        />
      </PortalMenu>
    );
  }

  return (
    <PortalMenu
      anchor={anchor}
      placement="below-start"
      onClose={onClose}
      wide={kind.startsWith('fn:')}
    >
      {kind.startsWith('fn:') ? (
        <SheetFunctionMenu
          family={kind.slice(3) as FunctionFamily}
          onPick={(name) => {
            onClose();
            insertFunction(c, actions, name);
          }}
        />
      ) : null}
      {kind === 'number'
        ? NUMBER_ROWS.map((row) => (
            <MenuActionRow
              key={row.label}
              plain
              label={row.label}
              icon={
                <Check
                  on={
                    (f?.nf ?? 'auto') === row.nf &&
                    (!row.cur || f?.cur === row.cur || (row.cur === '£' && !f?.cur))
                  }
                />
              }
              onClick={act(() => actions.numberFormat(row.nf, row.cur))}
            />
          ))
        : null}
      {kind === 'font'
        ? [{ id: null, label: 'Default', stack: undefined }, ...FONTS].map((font) => (
            <MenuActionRow
              key={font.id ?? 'default'}
              plain
              label={font.label}
              // Each font named in its own face, so the menu is its own preview.
              {...(font.stack ? { labelStyle: { fontFamily: font.stack } } : {})}
              icon={<Check on={(f?.ff ?? null) === font.id} />}
              onClick={act(() => actions.format({ ff: font.id }))}
            />
          ))
        : null}
      {kind === 'font-size'
        ? FONT_SIZES.map((fs) => (
            <MenuActionRow
              key={fs}
              plain
              label={String(fs)}
              icon={<Check on={(f?.fs ?? FONT_SIZE_DEFAULT) === fs} />}
              onClick={act(() => actions.format({ fs: fs === FONT_SIZE_DEFAULT ? null : fs }))}
            />
          ))
        : null}
      {kind === 'borders' ? (
        <SheetBordersPicker
          line={line}
          onLine={(l) => {
            lastLine = l;
            setLine(l);
          }}
          onPick={(mode) =>
            act(() =>
              actions.borders(mode, {
                w: line.w,
                s: line.s,
                c:
                  c.palette.text.startsWith('#') && c.palette.text.length === 7
                    ? c.palette.text
                    : '#000000',
              }),
            )()
          }
        />
      ) : null}
      {kind === 'merge' ? (
        mergeAsk ? (
          <SheetMergeConfirm
            range={range}
            onCancel={() => setMergeAsk(null)}
            onMerge={act(() => actions.merge(mergeAsk, () => true))}
          />
        ) : (
          <>
            <MenuActionRow
              plain
              label="Merge All"
              icon={<MergeIcon />}
              onClick={() => merge('all')}
            />
            <MenuActionRow
              plain
              label="Merge Across"
              icon={<MergeIcon />}
              onClick={() => merge('across')}
            />
            <MenuActionRow
              plain
              label="Unmerge"
              icon={<MergeIcon />}
              onClick={act(() => actions.unmerge())}
            />
          </>
        )
      ) : null}
      {kind === 'wrap'
        ? (['o', 'w', 'c'] as const).map((wr) => (
            <MenuActionRow
              key={wr}
              plain
              label={{ o: 'Overflow', w: 'Wrap', c: 'Clip' }[wr]}
              icon={<WrapIcon />}
              onClick={act(() => actions.format({ wr: wr === 'o' ? null : wr }))}
            />
          ))
        : null}
      {kind === 'sort' ? (
        <>
          <MenuActionRow
            plain
            label="Sort Sheet A to Z"
            icon={<SortIcon />}
            onClick={act(() => actions.sortColumn(true))}
          />
          <MenuActionRow
            plain
            label="Sort Sheet Z to A"
            icon={<SortIcon />}
            onClick={act(() => actions.sortColumn(false))}
          />
          <MenuActionRow
            plain
            label="Custom Sort…"
            icon={<SortIcon />}
            onClick={act(() => c.setMenu({ kind: 'sort' }))}
          />
        </>
      ) : null}
      {kind === 'freeze' ? <SheetFreezeRows actions={actions} onDone={onClose} /> : null}
      {kind === 'more'
        ? folded.map((b) => (
            <MenuActionRow
              key={b.label}
              plain
              label={b.label}
              icon={b.icon}
              onClick={() => {
                if (b.menu) onOpen(b.menu, anchor);
                else {
                  b.run?.();
                  onClose();
                }
              }}
            />
          ))
        : null}
    </PortalMenu>
  );
}

// Σ: SUM (and the others) of the selection into the cell below it, or a formula started in the active cell.
export function insertFunction(
  c: ReturnType<typeof useSheetController>,
  actions: SheetActions,
  name: string,
): void {
  const range = c.selection.ranges[c.selection.ranges.length - 1]!;
  const multi = range.r1 !== range.r2 || range.c1 !== range.c2;
  if (multi && range.r2 + 1 < c.sheet.layout.rows.length) {
    actions.goTo({ r1: range.r2 + 1, c1: range.c1, r2: range.r2 + 1, c2: range.c1 });
    c.setEditing({
      r: range.r2 + 1,
      c: range.c1,
      origin: 'cell',
      draft: `=${name}(${formatRange(range)})`,
    });
    return;
  }
  actions.startEdit('type', `=${name}(`);
}
