'use client';

// Freeze's rows (docs/specs/029-sheets/sheet.md "Freeze"): none, 1 or 2 rows, or up to the active cell's row, then
// the same for columns. In the toolbar's Freeze menu.
import { columnLetters } from '@livediagram/sheets';
import { MenuActionRow, MenuGroupSeparator, MenuHeader } from '@/components/primitives/PortalMenu';
import { useSheetController } from './sheet-controller';
import { CheckMark as Check, FreezeIcon } from './sheet-icons';
import type { SheetActions } from './useSheetActions';

export function SheetFreezeRows({
  actions,
  onDone,
}: {
  actions: SheetActions;
  onDone: () => void;
}) {
  const c = useSheetController();
  const act = (fn: () => void) => () => {
    fn();
    onDone();
  };
  const { r, c: col } = c.selection.active;
  return (
    <>
      <MenuHeader title="Rows" />
      {[0, 1, 2].map((n) => (
        <MenuActionRow
          key={`r${n}`}
          plain
          label={n === 0 ? 'No Rows' : `${n} Row${n > 1 ? 's' : ''}`}
          icon={<Check on={(c.sheet.layout.frozenRows ?? 0) === n} />}
          onClick={act(() => actions.freeze(n))}
        />
      ))}
      <MenuActionRow
        plain
        label={`Up to Row ${r + 1}`}
        icon={<FreezeIcon />}
        onClick={act(() => actions.freeze(r + 1))}
      />
      <MenuGroupSeparator />
      <MenuHeader title="Columns" />
      {[0, 1, 2].map((n) => (
        <MenuActionRow
          key={`c${n}`}
          plain
          label={n === 0 ? 'No Columns' : `${n} Column${n > 1 ? 's' : ''}`}
          icon={<Check on={(c.sheet.layout.frozenCols ?? 0) === n} />}
          onClick={act(() => actions.freeze(undefined, n))}
        />
      ))}
      <MenuActionRow
        plain
        label={`Up to Column ${columnLetters(col)}`}
        icon={<FreezeIcon />}
        onClick={act(() => actions.freeze(undefined, col + 1))}
      />
    </>
  );
}
