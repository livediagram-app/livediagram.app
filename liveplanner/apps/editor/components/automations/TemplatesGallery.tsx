'use client';

// The Templates gallery (docs/specs/026-plan/automations.md "The Automations screen": Templates), on its own tab and
// under the empty Rules list: the category chips (All, Status, Assigning, Due Dates, Forms, Telling People), then a
// tile per ready-made rule with its icon, name, sentence and category. Picking one hands its id up; the dialog opens
// the builder filled from the plan. The chips narrow the tiles in place and are this screen's own (never saved).

import { useId, useState } from 'react';
import {
  AUTOMATION_TEMPLATE_CATEGORIES,
  AUTOMATION_TEMPLATE_CATEGORY_NAMES,
  AUTOMATION_TEMPLATES,
  type AutomationTemplateCategory,
  type AutomationTemplateId,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideCalendarClock,
  lucideCheck,
  lucideClipboardList,
  lucideClock,
  lucideList,
  lucideMessageSquare,
  lucideTriangleAlert,
  lucideUser,
} from '@liveworkspace/icons/lucide';

type Glyph = ReturnType<typeof lucideGlyph>;

// Each tile's icon on its tint, as the design draws them.
const TILE: Readonly<Record<AutomationTemplateId, { Icon: Glyph; tint: string }>> = {
  'stamp-finish': {
    Icon: lucideGlyph(lucideCheck, 16),
    tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  'assign-on-start': {
    Icon: lucideGlyph(lucideUser, 16),
    tint: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  },
  'overdue-nudge': {
    Icon: lucideGlyph(lucideClock, 16),
    tint: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  'form-responses': {
    Icon: lucideGlyph(lucideClipboardList, 16),
    tint: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  'shipped-to-slack': {
    Icon: lucideGlyph(lucideMessageSquare, 16),
    tint: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  },
  'triage-bugs': {
    Icon: lucideGlyph(lucideTriangleAlert, 16),
    tint: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  'unblock-next': {
    Icon: lucideGlyph(lucideList, 16),
    tint: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  },
  'due-soon': {
    Icon: lucideGlyph(lucideCalendarClock, 16),
    tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
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
        aria-label="Templates"
        className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
      >
        {shown.map((t) => {
          const { Icon, tint } = TILE[t.id];
          return (
            <li key={t.id} className="flex">
              <button
                type="button"
                data-template={t.id}
                disabled={disabled}
                onClick={() => onPick(t.id)}
                className="flex w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-left outline-none transition hover:border-brand-300 hover:shadow-[0_4px_14px_rgba(124,58,237,0.08)] focus-visible:ring-2 focus-visible:ring-brand-400/60 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60"
              >
                <span
                  aria-hidden
                  className={`inline-flex size-8 items-center justify-center rounded-lg ${tint}`}
                >
                  <Icon aria-hidden />
                </span>
                <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                  {t.name}
                </span>
                <span className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.description}
                </span>
                <span className="mt-auto self-start rounded-[5px] bg-slate-100 px-1.5 py-1 text-[11px] font-semibold leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {AUTOMATION_TEMPLATE_CATEGORY_NAMES[t.category]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
