'use client';

// A board's card type chips (docs/specs/026-plan/plan-board.md "Card type chips"): in its header, after the title, a
// chip per card type the board takes, each a small card in its type's colour with its glyph, then its name. A click
// (or Enter or Space) adds a card of the type and opens it to be named, as Add Card does; a drag carries one onto the
// board, into the column and row it is let go over (useCardTypeDrag). PlanBoardView decides whether they show
// (chipsShown); in a header band they lead the header, straight after the menu box that holds the board's name. A
// type with card templates opens the Add a Card menu with that type alone instead (docs/specs/026-plan/item-types.md
// "Where a card is added, its templates are offered"); its drag still carries a blank card. They never shrink or clip:
// short of room they drop their names, then step out (useChipsFit, Work Tracker 1086).
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HoverCard, withArticle } from '@liveplanner/ui';
import {
  newItemId,
  type BoardProjection,
  type ItemFields,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { useCardTypeDrag } from '@/hooks/plan/useCardTypeDrag';
import { CHIP_NAMES_MAX, chipClickCell } from './card-type-chips';
import { AddCardPopover } from './AddCardPopover';
import { hasTemplates } from './card-template-start';
import { usePlan } from './PlanContext';
import { CardTypeTile } from './CardTypeTile';
import { HEADER_ARRIVAL_CLASS, headerArrivalIndex, headerArrivalRow } from './header-arrival';
import { PlanTypeGlyph } from './plan-type-glyph';
import { useChipsFit } from './use-chips-fit';
import { ACCENT_BG, ACCENT_TEXT, accentVars, type PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardCardTypeChips({
  setup,
  projection,
  types,
  palette,
}: {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  // The types the board takes (boardAddTypes), in the project's order.
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
}) {
  const plan = usePlan();
  const ghostRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // The type whose Add a Card menu is open, hung from its chip (a type with card templates).
  const [picking, setPicking] = useState<{ type: ItemTypeDef; anchor: HTMLElement } | null>(null);
  const add = (typeId: string, start?: ItemFields) => {
    if (!plan) return;
    const card = chipClickCell(setup, projection, plan.types, typeId, plan.statusNames, start);
    if (!card) return;
    const id = newItemId();
    void plan.addItem({
      id,
      type: card.type,
      fields: card.fields,
      status: card.status,
      after: card.after,
    });
    plan.openNewItem(id);
    const label = types.find((t) => t.id === typeId)?.label ?? 'Card';
    plan.announce(`${label} added to ${card.columnName}`);
  };
  // A press (a click that never travelled, or Enter or Space): a type with templates offers them first.
  const press = (typeId: string) => {
    const type = types.find((t) => t.id === typeId);
    const anchor = rowRef.current?.querySelector<HTMLElement>(
      `[data-card-type-chip="${CSS.escape(typeId)}"]`,
    );
    if (type && anchor && hasTemplates(type)) setPicking({ type, anchor });
    else add(typeId);
  };
  const { carrying, onPointerDown } = useCardTypeDrag({
    onClick: press,
    onRefused: (message) => plan?.announce(message),
    ghostRef,
  });
  const mode = useChipsFit(rowRef, types.length <= CHIP_NAMES_MAX, types.map((t) => t.id).join());
  const named = mode === 'named';
  const carried = carrying ? types.find((t) => t.id === carrying) : undefined;
  return (
    <div
      ref={rowRef}
      data-card-type-chips=""
      role="group"
      aria-label="Add Cards"
      // Never squeezed: its mode gives it the width it needs, or nothing (useChipsFit).
      data-chips-mode={mode}
      className="relative flex shrink-0 items-center gap-1"
      // The chips fan in as the header mounts, left to right (header-arrival.ts).
      style={headerArrivalRow}
      onDoubleClick={stop}
    >
      {(mode === 'none' ? [] : types).map((t, i) => (
        <HoverCard
          key={t.id}
          title={`Add ${withArticle(t.label)}`}
          description={
            hasTemplates(t)
              ? 'Click to start one from a template, or drag it onto the board.'
              : 'Click to add one, or drag it onto the board.'
          }
          disabled={!!carrying || picking?.type.id === t.id}
        >
          <button
            type="button"
            data-card-type-chip={t.id}
            aria-label={`Add ${withArticle(t.label)}`}
            {...(hasTemplates(t)
              ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': picking?.type.id === t.id }
              : {})}
            className={`${HEADER_ARRIVAL_CLASS} flex h-8 shrink-0 cursor-pointer touch-none select-none items-center gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/5 focus-visible:outline-2 dark:hover:bg-white/10 ${
              named ? 'pl-1.5 pr-2.5' : 'px-1.5'
            } ${carrying === t.id || picking?.type.id === t.id ? 'bg-black/5 dark:bg-white/10' : ''}`}
            style={{ color: palette.text, outlineColor: palette.focus, ...headerArrivalIndex(i) }}
            onPointerDown={(e) => onPointerDown(t.id, e)}
            onClick={(e) => {
              e.stopPropagation();
              // A pointer's click is the drag hook's (a press that never travelled); this is the keyboard's.
              if (e.detail === 0) press(t.id);
            }}
          >
            <CardTypeTile color={t.color} glyph={t.glyph} />
            {named ? <span className="whitespace-nowrap">{t.label}</span> : null}
          </button>
        </HoverCard>
      ))}
      {/* The measuring layer: the chips named and as little cards alone, unseen, for their widths (useChipsFit). */}
      <div
        aria-hidden
        inert
        data-chips-measure=""
        className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden"
      >
        {types.length <= CHIP_NAMES_MAX ? (
          <div data-chips-named-ghost="" className="flex w-max items-center gap-1">
            {types.map((t) => (
              <span
                key={t.id}
                className="flex h-8 shrink-0 items-center gap-1.5 pl-1.5 pr-2.5 text-[13px] font-medium"
              >
                <CardTypeTile color={t.color} glyph={t.glyph} />
                <span className="whitespace-nowrap">{t.label}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div data-chips-compact-ghost="" className="flex w-max items-center gap-1">
          {types.map((t) => (
            <span key={t.id} className="flex h-8 shrink-0 items-center px-1.5">
              <CardTypeTile color={t.color} glyph={t.glyph} />
            </span>
          ))}
        </div>
      </div>
      {picking ? (
        <AddCardPopover
          anchor={picking.anchor}
          types={[picking.type]}
          palette={palette}
          onClose={() => setPicking(null)}
          onAdd={(card) => add(card.type, card.fields)}
        />
      ) : null}
      {carried
        ? createPortal(
            // The card being carried: a small card in the type's colour, reading its new-card title.
            <div
              ref={ghostRef}
              data-card-type-ghost=""
              aria-hidden
              className="pointer-events-none fixed left-0 top-0 z-[1000] flex h-10 w-48 items-center gap-2 overflow-hidden rounded-lg border pr-3 text-[13px] font-semibold shadow-xl"
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
                color: palette.text,
                transform: 'translate(-9999px, -9999px)',
              }}
            >
              <span
                className={`h-full w-1 shrink-0 ${ACCENT_BG}`}
                style={accentVars(carried.color)}
              />
              <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(carried.color)}>
                <PlanTypeGlyph glyph={carried.glyph} size={14} />
              </span>
              <span className="truncate">{carried.newTitle}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
