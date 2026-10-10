'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CheckIcon, ChevronDownIcon } from '@livediagram/ui';
import { LEVEL_ORDER } from '@livediagram/api-schema';
import type { ShareRole } from '@/lib/api-client';
import { ROLE_PASS } from './share-dialog-parts';

// How long a mouse may leave the picker before it folds, so a pointer drifting past an edge does not snap it shut.
const HOVER_CLOSE_MS = 180;

// The pass's role (docs/specs/007-editor/live-app.md "Layout, top to bottom"; docs/specs/013-workspace/share-roles.md):
// one compact card naming the chosen role, which unfolds the three roles beneath it when hovered with a mouse or
// pressed. It unfolds in place rather than floating, so the dialog's scroll never clips it and nothing covers the
// fine print. Choosing a role folds it again.
export function ShareRolePicker({
  role,
  onChange,
}: {
  role: ShareRole;
  onChange: (role: ShareRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const listId = useId();
  const pass = ROLE_PASS[role];
  const { Icon } = pass;

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);

  // Hover opens for a mouse only: a touch press is a click, and a click toggles.
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    setOpen(true);
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };

  const choose = (next: ShareRole) => {
    onChange(next);
    setOpen(false);
  };

  // Arrow keys walk the roles, wrapping; Home and End reach the ends, as in any radio group.
  const onRoleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    const i = LEVEL_ORDER.indexOf(role);
    const last = LEVEL_ORDER.length - 1;
    const to: Record<string, number> = {
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    const next = LEVEL_ORDER[(to[e.key]! + LEVEL_ORDER.length) % LEVEL_ORDER.length]!;
    onChange(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-role="${next}"]`)
      ?.focus();
  };

  return (
    <div
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className={`overflow-hidden rounded-xl border-2 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none ${
        open ? `${pass.selected} shadow-md` : `${pass.selected} shadow-sm`
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Pass role: ${pass.title}. Change role`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pass.solid}`}
        >
          <Icon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {pass.title}
          </span>
          <span className="truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {pass.blurb}
          </span>
        </span>
        <ChevronDownIcon
          className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {/* Unfolds by easing its row from 0fr to 1fr; inert while folded so the hidden roles take no focus. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={listId}
            role="radiogroup"
            aria-label="What the pass lets people do"
            className="flex flex-col gap-1 border-t border-slate-200/70 p-1.5 dark:border-slate-700/70"
          >
            {LEVEL_ORDER.map((r) => {
              const option = ROLE_PASS[r];
              const OptionIcon = option.Icon;
              const active = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  data-role={r}
                  onClick={() => choose(r)}
                  onKeyDown={onRoleKey}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    active
                      ? 'bg-white/80 dark:bg-slate-900/60'
                      : 'hover:bg-white/60 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                      active
                        ? option.solid
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <OptionIcon />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      {option.title}
                    </span>
                    <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {option.blurb}
                    </span>
                  </span>
                  {active ? (
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${option.solid}`}
                    >
                      <CheckIcon size={10} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
