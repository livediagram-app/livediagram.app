'use client';

// The one option list: a bordered, rounded box holding a row per choice, one to a row, each its icon at the left then
// its name; the chosen row tinted in the brand colour with a tick at the right. The element menus' style pickers
// (Finish, a flowchart's or mind map's look, a Sankey's) and the tab window's tab list use it.
//
// Three kinds: `single` (one of a set: a radio group), `multiple` (each row on or off: checkboxes, a box at the
// right) and `action` (each row does something: buttons). Inside a command menu the rows are its items
// (menuitemradio / menuitemcheckbox / menuitem, the menu's own keys move between them); elsewhere they rove: one row
// is in the Tab order, ArrowUp / ArrowDown / Home / End move between rows, Enter or Space picks.
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CheckIcon, useMenuKind } from '@livedesign/ui';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';

export type OptionRow = {
  id: string;
  label: string;
  icon?: ReactNode;
  // A quiet second line under the name (where a status is used, a type's fields).
  detail?: ReactNode;
  // Shown at the right before the marker (a count).
  trailing?: ReactNode;
  disabled?: boolean;
  // A spoken name when the label alone would not say what pressing it does ("Add To Do").
  ariaLabel?: string;
};

type Kind =
  | { kind: 'single'; selected: string | null }
  | { kind: 'multiple'; selected: readonly string[] }
  | { kind: 'action' };

const ROW =
  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40';
const ON = 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100';
const OFF_MENU = 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70';

export function OptionRows({
  label,
  rows,
  onPick,
  onPreview,
  onPreviewEnd,
  className = '',
  ...kind
}: Kind & {
  // The list's accessible name.
  label: string;
  rows: readonly OptionRow[];
  onPick: (id: string) => void;
  // A live preview while a mouse rests on a row (a style picker's hover preview); touch never previews.
  onPreview?: (id: string) => void;
  onPreviewEnd?: () => void;
  // The caller's spacing only.
  className?: string;
}) {
  const inMenu = useMenuKind() === 'command';
  const box = useRef<HTMLDivElement>(null);
  const isOn = (id: string) =>
    kind.kind === 'single'
      ? kind.selected === id
      : kind.kind === 'multiple'
        ? kind.selected.includes(id)
        : false;
  // The row in the Tab order: the chosen one, else the first that can be pressed.
  const enabled = rows.filter((r) => !r.disabled);
  const tabStop = (enabled.find((r) => isOn(r.id)) ?? enabled[0])?.id;
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (inMenu) return;
    const all = [
      ...(box.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const at = all.indexOf(e.currentTarget);
    const to =
      e.key === 'ArrowDown'
        ? Math.min(all.length - 1, at + 1)
        : e.key === 'ArrowUp'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    all[to]?.focus();
  };
  const groupRole = kind.kind === 'single' && !inMenu ? 'radiogroup' : 'group';
  return (
    <div
      ref={box}
      role={groupRole}
      aria-label={label}
      className={`flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700 ${className}`}
    >
      {rows.map((r) => {
        const on = isOn(r.id);
        const role =
          kind.kind === 'single'
            ? inMenu
              ? 'menuitemradio'
              : 'radio'
            : kind.kind === 'multiple'
              ? inMenu
                ? 'menuitemcheckbox'
                : 'checkbox'
              : inMenu
                ? 'menuitem'
                : undefined;
        return (
          <button
            key={r.id}
            type="button"
            role={role}
            {...(kind.kind === 'action' ? {} : { 'aria-checked': on })}
            disabled={r.disabled}
            tabIndex={inMenu ? -1 : r.id === tabStop ? 0 : -1}
            data-option={r.id}
            aria-label={r.ariaLabel}
            className={`${ROW} ${on ? ON : OFF_MENU}`}
            onKeyDown={move}
            onClick={() => onPick(r.id)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(r.id)) : undefined}
            onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
          >
            {r.icon ? (
              <span aria-hidden className="flex shrink-0 items-center justify-center">
                {r.icon}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate ${on ? 'font-semibold' : 'font-medium'}`}>{r.label}</span>
              {r.detail ? (
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {r.detail}
                </span>
              ) : null}
            </span>
            {r.trailing}
            {kind.kind === 'single' ? (
              <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center">
                {on ? <CheckIcon size={14} /> : null}
              </span>
            ) : kind.kind === 'multiple' ? (
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                  on
                    ? 'bg-brand-700 text-white dark:bg-brand-600'
                    : 'border border-slate-300 dark:border-slate-600'
                }`}
              >
                {on ? <CheckIcon size={11} /> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
