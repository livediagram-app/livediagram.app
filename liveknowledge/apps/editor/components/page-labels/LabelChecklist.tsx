'use client';

// A menu of the knowledgebase's labels, each with a tick, to add to a choice or take away (docs/specs/030-knowledgebase/
// page-surface.md "The label filter", search-and-ask.md "Answer From"): a popover (a sheet on a phone) the tree's
// Filter by Label and the Ask view's All Pages open. The labels most used first. It stays open for the next.
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { KnowledgeLabel } from '@liveknowledge/document';
import { ResponsivePopover } from '@liveknowledge/ui';
import { LabelDot } from './LabelPill';
import { LabelTickIcon } from './page-labels-icons';

const ROW =
  'flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] text-slate-800 transition-colors duration-micro hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

export function LabelChecklist({
  open,
  anchor,
  onClose,
  title,
  labels,
  counts,
  chosen,
  onToggle,
  onClear,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  title: string;
  labels: readonly KnowledgeLabel[];
  counts: ReadonlyMap<string, number>;
  chosen: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const titleId = useId();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      list.current?.querySelector<HTMLElement>('[role=menuitemcheckbox]')?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // The menu opens only where there are labels, so it always holds a row.
    const all = [...list.current!.querySelectorAll<HTMLElement>('[role=menuitemcheckbox]')];
    const at = all.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    all[(at + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]!.focus();
  };
  return (
    <ResponsivePopover
      open={open}
      onClose={onClose}
      anchor={anchor}
      titleId={titleId}
      width={272}
      align="end"
    >
      <div data-label-checklist="" className="flex flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {chosen.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="-mr-1.5 inline-flex h-8 cursor-pointer items-center rounded-md px-2 text-[13px] font-medium text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div
          ref={list}
          role="menu"
          aria-labelledby={titleId}
          onKeyDown={onKey}
          className="-mx-1 flex max-h-72 flex-col gap-px overflow-y-auto overscroll-contain px-1 phone:max-h-[min(50vh,22rem)]"
        >
          {labels.map((label) => {
            const on = chosen.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                data-label-choice={label.id}
                onClick={() => onToggle(label.id)}
                className={ROW}
              >
                <LabelDot colour={label.colour} />
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                  {counts.get(label.id) ?? 0}
                </span>
                <span
                  aria-hidden
                  className={`flex w-4 shrink-0 justify-center text-brand-700 dark:text-brand-300 ${on ? '' : 'invisible'}`}
                >
                  <LabelTickIcon />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </ResponsivePopover>
  );
}
