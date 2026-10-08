'use client';

// Add New Card Type (docs/specs/026-plan/item-types.md "The Card Types panel"): one look wherever a card type can be
// added (Setup Board, a board's Add a Card menu, the Card Types panel): a full-width dashed row, a plus and the label,
// quiet until hovered, when it takes the brand colour. In a menu it is one of the menu's items (the arrow keys reach
// it). On a board it wears the board's colours (`palette`); elsewhere the chrome's.
import { PlusIcon } from '@livediagram/ui';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';
import type { PlanPalette } from './plan-palette';

const BASE =
  'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 text-[13px] font-medium transition hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-300';
// The board's colours through variables, so the hover classes win over them.
const ON_BOARD = 'border-[var(--line)] text-[var(--muted)]';
const IN_CHROME = 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400';

export function AddCardTypeButton({
  onClick,
  palette,
}: {
  onClick: () => void;
  palette?: PlanPalette;
}) {
  const { itemProps } = useMenuItemProps();
  return (
    <button
      type="button"
      {...itemProps}
      onClick={onClick}
      className={`${BASE} ${palette ? ON_BOARD : IN_CHROME}`}
      style={
        palette
          ? ({ '--line': palette.cardBorder, '--muted': palette.muted } as React.CSSProperties)
          : undefined
      }
    >
      <PlusIcon size={12} />
      Add New Card Type
    </button>
  );
}
