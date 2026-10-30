'use client';

// The type editor's Order (docs/specs/026-plan/item-types.md "Editing a type"): the states a type uses, in the order
// every status menu for its cards lists them. A row moves by dragging its grip (a mouse, a pen or a finger; the row
// follows the pointer and the rows it passes slide aside, Escape puts it back) or by Alt+Up and Alt+Down on the
// grip; its cross turns the state off. Numbered, so the order reads at a glance.
import { CloseIcon, Tooltip } from '@liveplanner/ui';
import { HANDLE_TOUCH, useHandleReorder } from '@/components/primitives/useHandleReorder';
import { GripIcon } from './ItemTypeFieldMenu';
import { ICON_BUTTON } from './ItemTypeFieldForms';

type Status = { status: string; name: string };

// `list` with `id` moved to `to` (its index once moved).
export function movedTo(list: readonly string[], id: string, to: number): string[] {
  const next = list.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

export function ItemTypeStatusOrder({
  shown,
  used,
  colours,
  onChange,
}: {
  // The states to list, in the type's order: the ones it uses that something names.
  shown: readonly Status[];
  // The type's whole list (kept ids nothing names included), which a move or a turn-off rewrites.
  used: readonly string[];
  // A state's colour on the boards, where one gives it one.
  colours?: ReadonlyMap<string, string>;
  onChange: (used: string[]) => void;
}) {
  const ids = shown.map((s) => s.status);
  // A move among the listed states keeps any unlisted id where it was, relative to the rest.
  const place = (id: string, to: number) => {
    const target = ids.filter((x) => x !== id)[to];
    const without = used.filter((x) => x !== id);
    const at = target === undefined ? without.length : without.indexOf(target);
    onChange(movedTo(used, id, target === undefined ? used.length : at));
  };
  const drag = useHandleReorder(ids, place);
  return (
    <ol aria-label="State order" className="flex flex-col gap-1">
      {shown.map((s, i) => {
        const handle = drag.handleProps(s.status);
        const colour = colours?.get(s.status);
        return (
          <li
            key={s.status}
            data-reorder-id={s.status}
            style={drag.rowStyle(s.status)}
            className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-1.5 py-1 odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 ${
              drag.draggingId === s.status
                ? 'border-brand-400 shadow-md dark:border-brand-500'
                : 'border-slate-200 shadow-sm dark:border-slate-700'
            }`}
          >
            <Tooltip label={`Move ${s.name}`}>
              <button
                type="button"
                aria-label={`Move ${s.name}`}
                disabled={shown.length < 2}
                {...handle}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                  const to = i + (e.key === 'ArrowUp' ? -1 : 1);
                  if (to < 0 || to >= shown.length) return;
                  e.preventDefault();
                  place(s.status, to);
                }}
                className={`flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:cursor-grabbing disabled:cursor-default disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${HANDLE_TOUCH}`}
              >
                <GripIcon />
              </button>
            </Tooltip>
            <span
              aria-hidden
              className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500"
            >
              {i + 1}
            </span>
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-current text-slate-400"
              style={colour ? { backgroundColor: colour, borderColor: colour } : undefined}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
              {s.name}
            </span>
            <Tooltip label={`Turn Off ${s.name}`}>
              <button
                type="button"
                aria-label={`Turn Off ${s.name}`}
                className={`${ICON_BUTTON} cursor-pointer`}
                onClick={() => onChange(used.filter((x) => x !== s.status))}
              >
                <CloseIcon size={10} />
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
