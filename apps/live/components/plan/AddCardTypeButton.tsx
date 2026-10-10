'use client';

// Add New Card Type (docs/specs/026-plan/item-types.md "The Card Types panel"): one look wherever a card type can be
// added (Setup Board, a board's Add a Card menu, the Card Types panel): the shared dashed add row. In a menu it is one
// of the menu's items (the arrow keys reach it). On a board it wears the board's colours (`palette`); elsewhere the
// chrome's.
import { DashedAddButton } from '@/components/primitives/DashedAddButton';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';
import type { PlanPalette } from './plan-palette';

export function AddCardTypeButton({
  onClick,
  palette,
}: {
  onClick: () => void;
  palette?: PlanPalette;
}) {
  const { itemProps } = useMenuItemProps();
  return (
    <DashedAddButton
      {...itemProps}
      label="Add New Card Type"
      onClick={onClick}
      tone={palette ? { line: palette.cardBorder, muted: palette.muted } : undefined}
    />
  );
}
