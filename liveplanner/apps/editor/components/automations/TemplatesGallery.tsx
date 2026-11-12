'use client';

// The Templates gallery (docs/specs/026-plan/automations.md "The Automations screen": Templates), on its own tab and
// under the empty Rules list: the category chips (All, Status, Assigning, Due Dates, Forms, Telling People), then a
// tile per ready-made rule: its living preview (TemplateScene), name, sentence and category. Picking one hands its id up; the dialog opens
// the builder filled from the plan. The chips narrow the tiles in place and are this screen's own (never saved).

import { useId, useState } from 'react';
import {
  AUTOMATION_TEMPLATE_CATEGORIES,
  AUTOMATION_TEMPLATE_CATEGORY_NAMES,
  AUTOMATION_TEMPLATES,
  type AutomationTemplateCategory,
  type AutomationTemplateId,
} from '@liveplanner/items';
import { TemplateScene, type SceneTone } from './TemplateScene';

// Each tile's colour, as the design draws them.
const TONE: Readonly<Record<AutomationTemplateId, SceneTone>> = {
  'stamp-finish': 'emerald',
  'assign-on-start': 'blue',
  'overdue-nudge': 'red',
  'form-responses': 'orange',
  'shipped-to-slack': 'violet',
  'triage-bugs': 'red',
  'unblock-next': 'blue',
  'due-soon': 'emerald',
  'clean-up-done': 'emerald',
  'escalate-urgent': 'red',
  'reopen-on-comment': 'blue',
  'route-reviews': 'violet',
  'due-on-start': 'orange',
  'flag-blocked': 'red',
  'verify-fix': 'emerald',
  'back-to-backlog': 'blue',
  'sort-incoming': 'violet',
  'summarise-requests': 'orange',
  'close-parent': 'emerald',
  'tell-unblocked': 'blue',
  'nudge-stuck': 'orange',
  'done-when-resolved': 'violet',
};

type Filter = AutomationTemplateCategory | 'all';

const CHIP_BASE =
  'touch-target-y relative h-[30px] cursor-pointer rounded-full border px-3 text-[12px] font-medium transition motion-reduce:transition-none';
const CHIP_ON =
  'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
const CHIP_OFF =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800';

export function TemplatesGallery({
  onPick,
  heading = 'Start From a Template',
  disabled = false,
}: {
  onPick: (id: AutomationTemplateId) => void;
  heading?: string;
  // The plan holds its 50 rules: the tiles show but don't open.
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const headingId = useId();
  const shown = AUTOMATION_TEMPLATES.filter((t) => filter === 'all' || t.category === filter);
  const chips: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...AUTOMATION_TEMPLATE_CATEGORIES.map((c) => ({
      value: c,
      label: AUTOMATION_TEMPLATE_CATEGORY_NAMES[c],
    })),
  ];
  return (
    <section aria-labelledby={headingId} data-templates="" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          id={headingId}
          className="mr-2 text-[13px] font-semibold text-slate-900 dark:text-slate-50"
        >
          {heading}
        </h3>
        <div role="group" aria-label="Template categories" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={filter === c.value}
              onClick={() => setFilter(c.value)}
              className={`${CHIP_BASE} ${filter === c.value ? CHIP_ON : CHIP_OFF}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <ul
        key={filter}
        aria-label="Templates"
        className="lvd-cascade grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
      >
        {shown.map((t) => (
          <li key={t.id} className="flex">
            <button
              type="button"
              data-template={t.id}
              disabled={disabled}
              onClick={() => onPick(t.id)}
              className="flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left outline-none transition duration-short hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_-12px_rgba(76,29,149,0.28),0_2px_6px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-brand-400/60 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60"
            >
              <TemplateScene id={t.id} tone={TONE[t.id]} />
              <span className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                  {t.name}
                </span>
                <span className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.description}
                </span>
                <span className="mt-auto self-start rounded-[5px] bg-slate-100 px-1.5 py-1 text-[11px] font-semibold leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {AUTOMATION_TEMPLATE_CATEGORY_NAMES[t.category]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
