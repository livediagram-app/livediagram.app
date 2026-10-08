'use client';

// Deleting a state that holds cards (docs/specs/026-plan/plan-board.md "The board set-up"): a popover anchored to
// Delete Status asking what happens to the cards first. Two option cards, one picked: move them to another column of
// this board (picked in a menu), or move them to the Trash (where they can be restored). The cards are the state's,
// so the choice reaches every board that shows it, and the popover says so. Cancel keeps the state; Delete Status
// does the move, then removes the state's column from every board.
import { useId, useState, type ReactNode } from 'react';
import type { PlanColumn } from '@livediagram/items';
import { Button, Select, TrashIcon } from '@livediagram/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { PlanTypeGlyph } from './plan-type-glyph';

export type RemoveColumnChoice = { kind: 'move'; to: string } | { kind: 'trash' };

const POPOVER_PX = 320;

export function RemoveColumnPopover({
  anchor,
  column,
  others,
  cardCount,
  onCancel,
  onRemove,
}: {
  anchor: HTMLElement;
  column: PlanColumn;
  // The board's other columns, in order: where the cards can go.
  others: readonly PlanColumn[];
  // The cards in the column's state (out of the Trash).
  cardCount: number;
  onCancel: () => void;
  onRemove: (choice: RemoveColumnChoice) => void;
}) {
  const [kind, setKind] = useState<'move' | 'trash'>(others.length > 0 ? 'move' : 'trash');
  const [to, setTo] = useState(others[0]?.status ?? '');
  const selectId = useId();
  const cards = cardCount === 1 ? 'Its card' : `Its ${cardCount} cards`;
  return (
    <AnchoredPopover
      anchor={anchor}
      name={`Delete ${column.name}`}
      width={POPOVER_PX}
      onClose={onCancel}
    >
      <div
        role="alertdialog"
        aria-label={`Delete ${column.name}`}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <div>
          <h3 className="text-[14px] font-semibold">Delete {column.name}?</h3>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            {cards} {cardCount === 1 ? 'is' : 'are'} in {column.name}, on every board that shows it.
            Where should {cardCount === 1 ? 'it' : 'they'} go?
          </p>
        </div>
        <div role="radiogroup" aria-label="Where the cards go" className="flex flex-col gap-1.5">
          {others.length > 0 ? (
            <Option
              on={kind === 'move'}
              onPick={() => setKind('move')}
              icon={<PlanTypeGlyph glyph="send" size={16} />}
              title="Move to Another Column"
            >
              <label htmlFor={selectId} className="sr-only">
                Move the cards to
              </label>
              <Select
                id={selectId}
                className="mt-1.5 w-full"
                selectClassName="text-[13px]"
                value={to}
                onFocus={() => setKind('move')}
                onChange={(e) => {
                  setKind('move');
                  setTo(e.target.value);
                }}
              >
                {others.map((c) => (
                  <option key={c.id} value={c.status}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Option>
          ) : null}
          <Option
            on={kind === 'trash'}
            onPick={() => setKind('trash')}
            icon={<TrashIcon size={16} />}
            title="Move to the Trash"
            danger
          >
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              You can restore them from the Trash.
            </p>
          </Option>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              onRemove(kind === 'move' && to ? { kind: 'move', to } : { kind: 'trash' })
            }
          >
            <TrashIcon size={14} />
            Delete Status
          </Button>
        </div>
      </div>
    </AnchoredPopover>
  );
}

// One choice as a card: a radio, an icon, its title and what goes with it.
function Option({
  on,
  onPick,
  icon,
  title,
  danger = false,
  children,
}: {
  on: boolean;
  onPick: () => void;
  icon: ReactNode;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const ring = on
    ? danger
      ? 'border-rose-300 bg-rose-50/70 dark:border-rose-500/50 dark:bg-rose-500/10'
      : 'border-brand-400 bg-brand-50/70 dark:border-brand-500/60 dark:bg-brand-500/10'
    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600';
  return (
    <div className={`rounded-lg border px-2.5 py-2 transition ${ring}`}>
      <button
        type="button"
        role="radio"
        aria-checked={on}
        className="flex w-full cursor-pointer items-center gap-2 text-left text-[13px] font-medium"
        onClick={onPick}
      >
        <span
          aria-hidden
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            on
              ? danger
                ? 'border-rose-500 dark:border-rose-400'
                : 'border-brand-600 dark:border-brand-400'
              : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          {on ? (
            <span
              className={`h-2 w-2 rounded-full ${danger ? 'bg-rose-500 dark:bg-rose-400' : 'bg-brand-600 dark:bg-brand-400'}`}
            />
          ) : null}
        </span>
        <span className={danger ? 'text-rose-700 dark:text-rose-300' : ''}>{icon}</span>
        {title}
      </button>
      <div className="pl-6">{children}</div>
    </div>
  );
}
