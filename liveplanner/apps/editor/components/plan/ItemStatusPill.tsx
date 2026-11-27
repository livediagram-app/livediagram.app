'use client';

// The card's column in the card panel's header on a phone (docs/specs/026-plan/plan-board.md "status pill"): a dot in
// the column's colour, its name (dropped below 360 px) and a chevron, as tall as the header's other chips. Pressed,
// the columns in a sheet (ItemStatusSheet); a pick moves the card at once, with a haptic tick and a toast to undo it.
// Someone who may not edit cards sees the pill without the chevron, and it does not open.
import { useState } from 'react';
import { ChevronDownIcon } from '@liveplanner/ui';
import { itemTitle, type Item, type ItemFieldValue, type ItemTypeDef } from '@liveplanner/items';
import { haptic } from '@liveworkspace/workbench/lib/haptics';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import { usePlan } from './PlanContext';
import { ItemStatusSheet, STATUS_PILL_ATTR } from './ItemStatusSheet';
import { statusDotColour, statusOptionsOf, statusPillGroups } from './status-options';

const NO_BOARDS: readonly { colours?: ReadonlyMap<string, string> }[] = [];
const NO_PHASES = new Map();

export function ItemStatusPill({
  item,
  type,
  statuses,
  canEdit,
  onSave,
}: {
  item: Item;
  type: ItemTypeDef;
  statuses: readonly { status: string; name: string }[];
  canEdit: boolean;
  onSave: (field: string, value: ItemFieldValue | undefined) => void | Promise<boolean>;
}) {
  const plan = usePlan();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const raw = item.fields['status'];
  // A state no board names reads as No status, as the Details picker reads it (plan-board.md "A state no board names").
  const current = statuses.find((s) => s.status === raw);
  const status = current?.status ?? '';
  const name = current?.name ?? 'No status';
  const phases = plan?.statusPhases ?? NO_PHASES;
  const boards = plan?.statusBoards ?? NO_BOARDS;
  const dotOf = (s: string) => statusDotColour(s, boards, phases);
  const dot = status ? (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none"
      style={{ backgroundColor: dotOf(status) }}
    />
  ) : (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full border border-slate-400 dark:border-slate-500"
    />
  );
  // The name eases in afresh when the column changes (keyed by it); cut with an ellipsis, gone below 360 px.
  const label = (
    <span
      key={status}
      className="min-w-0 truncate animate-fade-in motion-reduce:animate-none max-[359px]:hidden"
    >
      {name}
    </span>
  );
  const chip =
    'flex h-6 min-w-0 max-w-[10rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2 text-[12px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  if (!canEdit)
    return (
      <span
        role="img"
        aria-label={`Status: ${name}`}
        data-status-pill-readonly=""
        className={`${chip} pr-2`}
      >
        {dot}
        {label}
      </span>
    );

  const move = (next: string) => {
    const back = status || undefined;
    void onSave('status', next);
    haptic('snap');
    track('Plan', 'Changed', 'StatusFromHeader');
    const to = statuses.find((s) => s.status === next)?.name ?? next;
    const key = `status-moved:${item.id}`;
    toast.action({
      key,
      message: `Moved to ${to}`,
      actions: [
        {
          label: 'Undo',
          ariaLabel: `Undo moving to ${to}`,
          onSelect: () => {
            void onSave('status', back);
            toast.dismissAction(key);
          },
        },
      ],
    });
  };
  const groups = statusPillGroups(statusOptionsOf(type, statuses, status), phases);
  return (
    <>
      <button
        type="button"
        {...{ [STATUS_PILL_ATTR]: '' }}
        aria-label={`Status: ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${chip} relative touch-target cursor-pointer pr-1.5 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-[0.97] motion-reduce:active:scale-100 dark:hover:border-slate-600`}
      >
        {dot}
        {label}
        <span aria-hidden className="shrink-0 text-slate-400">
          <ChevronDownIcon size={11} />
        </span>
      </button>
      {open ? (
        <ItemStatusSheet
          title={itemTitle(item)}
          current={status}
          open={groups.open}
          done={groups.done}
          dotOf={dotOf}
          onPick={move}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
