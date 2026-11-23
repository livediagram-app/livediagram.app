'use client';

// The Card Types panel (docs/specs/026-plan/item-types.md "The Card Types panel"): the project's item
// types, each with its glyph and colour, its name and how many items have it. A popover hanging above
// its button in Plan mode's bottom-right cluster. Edit and Add Card Type open the type editor, Duplicate opens it on a
// new type filled from that one. One list:
// no type is set apart from another. Someone who may only view sees the list.
import { cardTypesHeroArt } from './CardTypesHeroArt';
import { AddCardTypeButton } from './AddCardTypeButton';
import { useMemo } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { usePlan } from './PlanContext';
import { ITEM_TYPES_MAX } from '@liveplanner/items';
import { DuplicateIcon, EmptyState, PencilIcon, PlanCardsIcon, Tooltip } from '@liveplanner/ui';
import { CardTypeTile } from './CardTypeTile';
import { typeSummary } from './card-type-summary';
import { ACCENT_BG, accentVars } from './plan-palette';

export function CardTypesPanel({
  popoverOpen,
  popoverAnchor,
  onPopoverClose,
}: {
  popoverOpen: boolean;
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const counts = useMemo(() => {
    const n = new Map<string, number>();
    for (const it of plan?.items.values() ?? []) n.set(it.type, (n.get(it.type) ?? 0) + 1);
    return n;
  }, [plan?.items]);
  if (!plan) return null;
  const { types, canEdit } = plan;
  const full = types.length >= ITEM_TYPES_MAX;
  // One type's row: its edit (stretched over the row), Duplicate, and the pencil.
  const row = (t: (typeof types)[number]) => {
    const count = counts.get(t.id) ?? 0;
    const label = `${count} ${count === 1 ? 'item' : 'items'}`;
    // The type's glyph, name, field count and item count: the row's face, in its edit button.
    // A type no card has yet is shown a little grey (its count is in its name for a screen reader, not on show).
    const face = (
      <span
        className={`flex min-w-0 flex-1 items-center gap-2.5 ${count === 0 ? 'opacity-55' : ''}`}
      >
        <CardTypeTile color={t.color} glyph={t.glyph} size={30} />
        <span className="flex min-w-0 flex-1 flex-col" aria-hidden>
          <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {t.label}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {typeSummary(t)}
            {/* An inherited type names its base (docs/specs/026-plan/item-types.md "Inherited types"). */}
            {t.inherits
              ? ` · Inherits ${types.find((b) => b.id === t.inherits)?.label ?? t.inherits}`
              : ''}
          </span>
        </span>
      </span>
    );
    return (
      <li
        key={t.id}
        className={`group relative flex items-center gap-2.5 bg-white py-2 pl-3 pr-2 transition-colors motion-reduce:transition-none dark:bg-slate-900 ${
          canEdit
            ? 'hover:bg-slate-50 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-400 dark:hover:bg-slate-800/70'
            : ''
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1 ${ACCENT_BG}`}
          style={accentVars(t.color)}
          aria-hidden
        />
        {/* The row's edit and its duplicate are sibling buttons, never one inside the other: the edit
                    button stretches over the whole row (its ::after), and Duplicate sits above it. */}
        {canEdit ? (
          <button
            type="button"
            aria-label={`${t.label}, ${label}. Edit`}
            onClick={() => plan.editType({ id: t.id })}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-none after:absolute after:inset-0 after:content-['']"
          >
            {face}
          </button>
        ) : (
          <div
            role="group"
            className="flex min-w-0 flex-1 items-center gap-2.5"
            aria-label={`${t.label}, ${label}`}
          >
            {face}
          </div>
        )}
        {canEdit ? (
          <Tooltip
            label={full ? 'The plan has the most card types it can hold' : `Duplicate ${t.label}`}
          >
            <button
              type="button"
              aria-label={
                full ? 'The plan has the most card types it can hold' : `Duplicate ${t.label}`
              }
              aria-disabled={full || undefined}
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition ${
                full
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
              onClick={() => {
                if (!full) plan.editType('new', t.id);
              }}
            >
              <DuplicateIcon size={14} />
            </button>
          </Tooltip>
        ) : null}
        {canEdit ? (
          <span
            className="pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200"
            aria-hidden
          >
            <PencilIcon />
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <MovablePanel
      title="Card Types"
      hero={{
        art: cardTypesHeroArt,
        subtitle: 'The kinds of card this plan uses.',
        // The line stops short of the art in the bottom right.
        className: 'sm:pr-[7.5rem]',
      }}
      helpArticle="planCardTypes"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-[34rem]"
      popoverWidth="w-[calc(100vw-2rem)] sm:w-[34rem]"
      onMoveTo={() => {}}
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        {/* One to a row in a bordered box, as Plan's option lists are (docs/specs/026-plan/plan-board.md "Option
            lists"). A project starts with none: its types come from a board that brings them, or from the owner's own. */}
        {types.length === 0 ? (
          <EmptyState
            icon={<PlanCardsIcon size={18} />}
            title="No card types yet"
            description={
              canEdit
                ? 'Add a card type of your own, or add a board that brings its types.'
                : 'This plan has no card types yet.'
            }
          />
        ) : (
          <ul
            aria-label="Card Types"
            className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
          >
            {types.map(row)}
          </ul>
        )}
        {canEdit ? <AddCardTypeButton onClick={() => plan.editType('new')} /> : null}
      </div>
    </MovablePanel>
  );
}
