'use client';

// "Add a card" (docs/specs/026-plan/plan-board.md "Working on a board"): a cell's Add card button
// opens this menu, as Pages mode's + opens "Add a page". It offers the card types the board shows,
// each a tile with its glyph on its colour; choosing one adds a card of it (titled "New task"...) at
// the end of the cell, to be titled in place or in its panel. Built on the shared PortalMenu and
// option list (OptionRows), so arrow keys, Escape, focus return and an outside press behave as every other
// menu does; a wheel or trackpad pan outside it closes it too, since the board it hangs from moves
// away. On a phone it is a bottom sheet that takes focus on its first choice and closes on Escape or a tap outside
// it, focus going back to the button. It wears the board's colours (the tab's theme), as the cells it opens from do;
// a new card type is made from the Card Types panel or Board, Supported Cards, not from here.
import { useCallback, useEffect, useRef, type SyntheticEvent } from 'react';
import { type ItemFields, type ItemTypeDef } from '@liveplanner/items';
import { useClickOutside, useEscape } from '@liveplanner/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { PortalMenu } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { OptionRows } from './OptionRows';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { CardTypeTile } from './CardTypeTile';
import { typeSummary } from './card-type-summary';
import type { PlanPalette } from './plan-palette';

export type NewCard = { type: string; fields: ItemFields };

// A portal's events still bubble up the React tree to the board and canvas.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function AddCardPopover({
  anchor,
  types,
  onAdd,
  palette,
  onClose,
}: {
  // The Add card button the menu hangs from.
  anchor: HTMLElement | null;
  // The types this board shows, in the project's order.
  types: readonly ItemTypeDef[];
  onAdd: (card: NewCard) => void;
  // The board's colours, to wear the tab's theme (docs/specs/026-plan/plan-board.md "Theme and style").
  palette?: PlanPalette;
  onClose: () => void;
}) {
  const mobile = useIsMobileViewport();
  // Closes on a wheel (a pan or a zoom) anywhere but the menu itself, which may scroll.
  const box = useRef<HTMLDivElement>(null);
  const close = useLatest(onClose);
  useEffect(() => {
    if (mobile) return;
    const onWheel = (e: WheelEvent) => {
      const menu = box.current?.ownerDocument.querySelector('[data-add-card-menu]');
      if (e.target instanceof Node && menu?.contains(e.target)) return;
      close.current();
    };
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, [mobile, close]);
  // The sheet keeps its own Escape and outside tap (BottomSheet leaves both to its menu), and starts on its first
  // choice, as the desktop menu does. A tap on its own Add card button is that button's toggle.
  const sheet = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    close.current();
    anchor?.focus();
  };
  useEscape(dismiss, { enabled: mobile, capture: true, stopPropagation: true });
  useClickOutside(sheet, () => close.current(), mobile, '[data-add-card-trigger]');
  // The sheet mounts through a portal, after this component: its first choice takes focus as it attaches.
  const attachSheet = useCallback((el: HTMLDivElement | null) => {
    sheet.current = el;
    el?.querySelector<HTMLElement>('[data-option]')?.focus();
  }, []);
  const choices = (
    <AddCardChoices
      types={types}
      onAdd={(card) => {
        onClose();
        onAdd(card);
      }}
      {...(palette ? { palette } : {})}
    />
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={attachSheet}
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
          {choices}
        </div>
      </BottomSheet>
    );
  }
  return (
    // display: contents, so it lays out nothing; it only catches what bubbles out of the portal, and
    // keys typed in the menu never reach the canvas's shortcuts.
    <div ref={box} className="contents" onPointerDown={stop} onClick={stop} onKeyDown={stop}>
      <PortalMenu
        anchor={anchor}
        placement="below-start"
        onClose={onClose}
        initialFocus="first"
        {...(palette
          ? {
              surfaceStyle: {
                backgroundColor: palette.column,
                borderColor: palette.border,
                color: palette.text,
              },
            }
          : {})}
      >
        {/* A small heading, then a row per type: its small card, its name and what it holds. */}
        <div data-add-card-menu="" className="min-w-0 pt-1">
          <p
            className={`px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide ${palette ? '' : 'text-slate-500 dark:text-slate-400'}`}
            style={palette ? { color: palette.muted } : undefined}
          >
            Add a Card
          </p>
          {choices}
        </div>
      </PortalMenu>
    </div>
  );
}

// The menu's choices: a row per card type (its glyph on a tint of its colour, its name), in the board's colours when
// given; a board taking no types yet says where to turn one on.
function AddCardChoices({
  types,
  onAdd,
  palette,
}: {
  types: readonly ItemTypeDef[];
  onAdd: (card: NewCard) => void;
  palette?: PlanPalette;
}) {
  if (types.length === 0)
    return (
      <p
        className={`px-3 pb-2 text-xs ${palette ? '' : 'text-slate-500 dark:text-slate-400'}`}
        style={palette ? { color: palette.muted } : undefined}
      >
        No card types on this board yet. Turn one on in Board, Supported Cards.
      </p>
    );
  return (
    <OptionRows
      kind="action"
      label="Card Types"
      className="mx-1 my-1"
      {...(palette ? { palette } : {})}
      rows={types.map((t) => ({
        id: t.id,
        label: t.label,
        // The header chips' small card (CardTypeTile), and what the type holds under its name.
        icon: <CardTypeTile color={t.color} glyph={t.glyph} size={28} />,
        detail: typeSummary(t),
        // Spoken by its name alone: the field count is a sighted aside.
        ariaLabel: t.label,
      }))}
      onPick={(id) => {
        const t = types.find((x) => x.id === id);
        if (t) onAdd({ type: t.id, fields: { title: t.newTitle } });
      }}
    />
  );
}
