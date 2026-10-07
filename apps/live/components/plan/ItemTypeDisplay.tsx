'use client';

// The type editor's Display (docs/specs/026-plan/item-types.md "Editing a type": Display): where this type's cards
// show each field, per card size. A size switch; the card's layout drawn large with its slots outlined, each
// holding its fields as chips that drag (mouse, pen or touch) to another slot or place, or move with the arrow keys;
// Add a Field, the type's fields not yet on the card, each saying where it lands; and a large Preview, a real card
// drawn as a board draws it. Reset to Default puts a size back; a size equal to its default is stored as absent.
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  CARD_FIELDS,
  CARD_SIZES,
  CARD_SLOT_LABELS,
  cardDisplayFields,
  cardLayoutFields,
  cardSlotFits,
  defaultCardLayout,
  defaultCardSlot,
  sameCardLayout,
  typeCardLayout,
  typeOffersCardField,
  type CardDisplay,
  type CardField,
  type CardLayout,
  type CardSize,
  type CardSlot,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { Button, CloseIcon, PlusIcon } from '@livediagram/ui';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { FIELD_GLYPHS } from '@/components/palette/PlanBoardMenuSection';
import { CARD_FIELD_LABELS } from './board-setup-edits';
import { addCardField, moveCardField, neighbourSlot, removeCardField } from './card-layout-edits';
import { PlanCardFace } from './PlanCardFace';
import { PlanTypeGlyph } from './plan-type-glyph';
import { planPalette } from './plan-palette';

export type CardDisplayDraft = CardDisplay;

const SIZE_LABELS: Record<CardSize, string> = {
  minimal: 'Minimal',
  compact: 'Compact',
  detailed: 'Detailed',
};
// The preview card's width on a board, and how much larger the preview draws it (CSS zoom, so its box grows too).
const PREVIEW_PX = 260;
const PREVIEW_ZOOM = 1.3;
// How far a press travels before it is a drag (a shorter press is a click).
const DRAG_START_PX = 4;

const SAMPLE_PERSON = { id: 'sample-person', name: 'Sam Rivera', color: '#0d9488' };

const dayFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// A card with something in every field, so each placed field shows on the preview.
function sampleCard(type: ItemTypeDef): Item {
  return {
    id: 'sample-card',
    type: type.id,
    key: 12,
    rank: 'a',
    fields: {
      title: `Example ${type.label || 'card'}`,
      assignee: SAMPLE_PERSON,
      priority: 'high',
      due: dayFromToday(3),
      start: dayFromToday(-2),
      labels: ['Design'],
      estimate: 3,
      checklist: [
        { id: 'a', text: 'One', done: true },
        { id: 'b', text: 'Two', done: true },
        { id: 'c', text: 'Three', done: false },
        { id: 'd', text: 'Four', done: false },
        { id: 'e', text: 'Five', done: false },
      ],
      description: 'A short description of the work, as its first lines read on a card.',
      votes: { 'sample-person': 3 },
      comments: { comments: [{}, {}] },
    },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAMPLE_PERSON,
    updatedBy: SAMPLE_PERSON,
  } as unknown as Item;
}

const fieldIcon = (f: CardField, size = 14) =>
  f === 'key' ? (
    <span className="text-[12px] font-semibold leading-none">#</span>
  ) : (
    <PlanTypeGlyph glyph={FIELD_GLYPHS[f]} size={size} />
  );

type Drag = { field: CardField; startX: number; startY: number; moving: boolean };
type Target = { slot: CardSlot; index: number };

export function ItemTypeDisplay({
  type,
  display,
  onChange,
}: {
  // The type as drafted (its fields, colour, glyph and name), for the layout and the preview.
  type: ItemTypeDef;
  display: CardDisplayDraft;
  onChange: (next: CardDisplayDraft) => void;
}) {
  const [size, setSize] = useState<CardSize>('compact');
  const drafted = useMemo(() => ({ ...type, display }), [type, display]);
  const layout = typeCardLayout(drafted, size);
  const placed = cardLayoutFields(size, layout);
  const addable = cardDisplayFields(size).filter(
    (f) => typeOffersCardField(type, f) && !placed.includes(f),
  );
  const isDefault = sameCardLayout(size, layout, defaultCardLayout(type.id, size));
  const sample = useMemo(() => sampleCard(type), [type]);
  const palette = planPalette(useCanvasSurface());
  const setLayout = (next: CardLayout) => onChange({ ...display, [size]: next });

  // Dragging a placed chip: where it would land, from the slot under the pointer and the chip centres in it.
  const editor = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const targetAt = (field: CardField, x: number, y: number): Target | null => {
    const zone = (document.elementsFromPoint?.(x, y) ?? [])
      .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-slot]'))
      .find((el) => !!el && !!editor.current?.contains(el));
    const slot = zone?.dataset.slot as CardSlot | undefined;
    if (!zone || !slot || !cardSlotFits(size, slot, field)) return null;
    let index = 0;
    for (const chip of zone.querySelectorAll<HTMLElement>('[data-chip]')) {
      if (chip.dataset.chip === field) continue;
      const r = chip.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      if (cy < y - r.height / 2 || (Math.abs(cy - y) <= r.height / 2 && r.left + r.width / 2 < x))
        index += 1;
    }
    return { slot, index };
  };
  const endDrag = () => {
    setDrag(null);
    setTarget(null);
  };
  const chipPointer = (field: CardField) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Not capturable: the drag still follows while over the chip.
      }
      setDrag({ field, startX: e.clientX, startY: e.clientY, moving: false });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!drag || drag.field !== field) return;
      const moving =
        drag.moving || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_START_PX;
      if (moving !== drag.moving) setDrag({ ...drag, moving });
      if (moving) setTarget(targetAt(field, e.clientX, e.clientY));
    },
    onPointerUp: () => {
      if (drag?.moving && target)
        setLayout(moveCardField(size, layout, field, target.slot, target.index));
      endDrag();
    },
    onPointerCancel: endDrag,
  });
  // The keyboard's way: Left and Right move a chip within its slot, Up and Down to the slot before or after,
  // Delete or Backspace takes it off.
  const chipKeys = (field: CardField, slot: CardSlot) => (e: KeyboardEvent<HTMLElement>) => {
    const list = layout[slot] ?? [];
    const at = list.indexOf(field);
    let next: CardLayout | null = null;
    if (e.key === 'ArrowLeft' && at > 0) next = moveCardField(size, layout, field, slot, at - 1);
    else if (e.key === 'ArrowRight' && at < list.length - 1)
      next = moveCardField(size, layout, field, slot, at + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const to = neighbourSlot(size, slot, field, e.key === 'ArrowUp' ? -1 : 1);
      if (to) next = moveCardField(size, layout, field, to, (layout[to] ?? []).length);
    } else if (e.key === 'Delete' || e.key === 'Backspace') next = removeCardField(layout, field);
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    setLayout(next);
    // Focus follows the chip to where it went.
    requestAnimationFrame(() =>
      editor.current?.querySelector<HTMLElement>(`[data-chip="${field}"]`)?.focus(),
    );
  };

  const zone = (slot: CardSlot, extra = '') => {
    const fields = layout[slot] ?? [];
    const label = CARD_SLOT_LABELS[size][slot]!;
    const lit = !!drag?.moving && target?.slot === slot;
    const takes = !!drag?.moving && cardSlotFits(size, slot, drag.field);
    const others = fields.filter((f) => f !== drag?.field);
    return (
      <div
        data-slot={slot}
        role="group"
        aria-label={label}
        className={`relative flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-dashed px-1.5 py-1 transition ${
          lit
            ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
            : takes
              ? 'border-brand-300 dark:border-brand-500/50'
              : 'border-slate-300 dark:border-slate-600'
        } ${extra}`}
      >
        {fields.length === 0 ? (
          <span className="px-1 text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
        ) : null}
        {fields.map((f) => (
          <span key={f} className="flex items-center">
            {lit && target && others[target.index] === f ? (
              <span aria-hidden className="mr-1 h-5 w-0.5 rounded bg-brand-500" />
            ) : null}
            <span
              data-chip={f}
              tabIndex={0}
              role="button"
              aria-label={`${CARD_FIELD_LABELS[f]}, in ${label}. Arrow keys move it, Delete takes it off.`}
              {...chipPointer(f)}
              onKeyDown={chipKeys(f, slot)}
              className={`flex cursor-grab touch-none select-none items-center gap-1 rounded-md border bg-white py-0.5 pl-1.5 pr-0.5 text-[12px] font-medium text-slate-700 shadow-sm transition active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-slate-900 dark:text-slate-200 ${
                drag?.moving && drag.field === f
                  ? 'border-brand-400 opacity-50'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-slate-500 dark:text-slate-400">{fieldIcon(f, 12)}</span>
              {CARD_FIELD_LABELS[f]}
              <button
                type="button"
                aria-label={`Take ${CARD_FIELD_LABELS[f]} off the card`}
                tabIndex={-1}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setLayout(removeCardField(layout, f))}
              >
                <CloseIcon size={10} />
              </button>
            </span>
          </span>
        ))}
        {lit && target && target.index >= others.length ? (
          <span aria-hidden className="h-5 w-0.5 rounded bg-brand-500" />
        ) : null}
      </div>
    );
  };
  const titleBar = (
    <span className="min-w-0 flex-1 truncate px-1 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
      {String(sample.fields['title'])}
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Place the fields where this type&apos;s cards show them at each card size: add one, then
        drag it to the spot you want. A board&apos;s Show on Cards can still hide them on that
        board.
      </p>
      <div
        role="radiogroup"
        aria-label="Card size"
        className="inline-flex self-start rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {CARD_SIZES.map((z) => (
          <button
            key={z}
            type="button"
            role="radio"
            aria-checked={size === z}
            className={`cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium transition ${
              size === z
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
            onClick={() => setSize(z)}
          >
            {SIZE_LABELS[z]}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The card's layout: its slots where the card draws them. */}
          <div
            ref={editor}
            role="group"
            aria-label={`${SIZE_LABELS[size]} card layout`}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {size === 'minimal' ? (
              <div className="flex flex-wrap items-center gap-2">
                {zone('lead')}
                {titleBar}
                {zone('trail')}
              </div>
            ) : size === 'compact' ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {zone('lead')}
                  {titleBar}
                </div>
                {zone('row')}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {zone('head', 'flex-1')}
                  {zone('headEnd')}
                </div>
                {titleBar}
                {zone('body')}
                {zone('foot')}
              </>
            )}
          </div>
          <section aria-label="Add a Field" className="flex flex-col gap-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Add a Field
            </h4>
            {addable.length === 0 ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                Every field this type has is on the card.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {addable.map((f) => (
                  <li key={f}>
                    <button
                      type="button"
                      aria-label={`Add ${CARD_FIELD_LABELS[f]}`}
                      className="group flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10"
                      onClick={() => setLayout(addCardField(size, layout, f))}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {fieldIcon(f)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                          {CARD_FIELD_LABELS[f]}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                          Adds to {CARD_SLOT_LABELS[size][defaultCardSlot(size, f)]}
                        </span>
                      </span>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-brand-700 transition group-hover:bg-brand-100 dark:text-brand-300 dark:group-hover:bg-brand-500/20">
                        <PlusIcon size={12} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex items-center gap-2">
            {!isDefault ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  const { [size]: _drop, ...rest } = display;
                  onChange(rest);
                }}
              >
                Reset to Default
              </Button>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing the default for {type.label || 'this type'}.
              </span>
            )}
          </div>
        </div>
        <figure aria-label="Preview" className="flex flex-col gap-1.5">
          <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Preview
          </figcaption>
          <div className="rounded-xl p-4" style={{ backgroundColor: palette.column }}>
            <div
              className="pointer-events-none"
              style={{ width: PREVIEW_PX, zoom: PREVIEW_ZOOM }}
              aria-hidden
            >
              <PlanCardFace
                item={sample}
                palette={palette}
                fields={CARD_FIELDS}
                size={size}
                typeOverride={drafted}
              />
            </div>
          </div>
        </figure>
      </div>
    </div>
  );
}
