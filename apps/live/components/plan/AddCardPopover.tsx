'use client';

// "Add a card" (docs/specs/026-plan/plan-board.md "Working on a board"): a cell's Add card button
// opens this menu, as Illustrate's + opens "Add a page". It offers the card types the board shows,
// each a tile with its glyph on its colour; choosing one adds a card of it (titled "New task"...) at
// the end of the cell, to be titled in place or in its panel. Built on the shared PortalMenu and
// MenuTile grid, so arrow keys, Escape, focus return and an outside press behave as every other
// menu does. On a phone it is a bottom sheet.
import type { SyntheticEvent } from 'react';
import { type ItemFields, type ItemTypeDef } from '@livediagram/items';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, ACCENT_TINT, accentVars } from './plan-palette';

export type NewCard = { type: string; fields: ItemFields };

// A portal's events still bubble up the React tree to the board and canvas.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function AddCardPopover({
  anchor,
  types,
  onAdd,
  onClose,
}: {
  // The Add card button the menu hangs from.
  anchor: HTMLElement | null;
  // The types this board shows, in the document's order.
  types: readonly ItemTypeDef[];
  onAdd: (card: NewCard) => void;
  onClose: () => void;
}) {
  const mobile = useIsMobileViewport();
  const choose = (type: ItemTypeDef) => {
    onClose();
    onAdd({ type: type.id, fields: { title: type.newTitle } });
  };
  const tiles = (
    <MenuTileGrid cols={3}>
      {types.map((t) => (
        <MenuTile
          key={t.id}
          label={t.label}
          icon={
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md ${ACCENT_TINT} ${ACCENT_TEXT}`}
              style={accentVars(t.color)}
            >
              <PlanTypeGlyph glyph={t.glyph} size={16} />
            </span>
          }
          onClick={() => choose(t)}
        />
      ))}
    </MenuTileGrid>
  );

  if (mobile) {
    return (
      <BottomSheet
        role="dialog"
        aria-label="Add a card"
        onClose={onClose}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={stop}
      >
        <div className="flex flex-col gap-1 px-2 pb-3" onKeyDown={stop}>
          <p className="px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Add a Card
          </p>
          {tiles}
        </div>
      </BottomSheet>
    );
  }
  return (
    // display: contents, so it lays out nothing; it only catches what bubbles out of the portal, and
    // keys typed in the menu never reach the canvas's shortcuts.
    <div className="contents" onPointerDown={stop} onClick={stop} onKeyDown={stop}>
      <PortalMenu anchor={anchor} placement="below-start" onClose={onClose} initialFocus="first">
        {/* No header: it opens right under its own Add card button, which names it. */}
        {tiles}
      </PortalMenu>
    </div>
  );
}
