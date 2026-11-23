'use client';

// The Templates gallery (liveplanner/docs/specs/026-plan/automations.md "The Automations screen": Templates): the
// app's templates as tiles, each with its picture, name, what it does and its category, under category chips that
// narrow them. Picking one opens the builder filled from the item. The list, the categories and each picture are the
// app's (kit.templates); a category it does not offer here (kit.kinds.useOffer) is left out with its templates.

import { useId, useState, type ReactElement } from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { useAutomationsKit, useAutomationsOffer } from './kit-context';

/** A tile's tooltip where there is something to say, else the tile alone. */
function Tip({ label, children }: { label: string | undefined; children: ReactElement }) {
  return label ? <Tooltip label={label}>{children}</Tooltip> : children;
}

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
  offReason,
}: {
  onPick: (id: string) => void;
  heading?: string;
  // The item holds all the rules it may: the tiles show but don't open.
  disabled?: boolean;
  // Why they don't open, as each tile's tooltip (with Pro on).
  offReason?: string | undefined;
}) {
  const [filter, setFilter] = useState('all');
  const headingId = useId();
  const kit = useAutomationsKit();
  const { templates } = kit;
  const hidden = useAutomationsOffer().hiddenTemplateCategories;
  const offered = (category: string) => !hidden?.has(category);
  const names = new Map(templates.categories.map((c) => [c.id, c.name]));
  const shown = templates.list.filter(
    (t) => offered(t.category) && (filter === 'all' || t.category === filter),
  );
  const chips: readonly { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    ...templates.categories
      .filter((c) => offered(c.id))
      .map((c) => ({ value: c.id, label: c.name })),
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
            <Tip label={disabled ? offReason : undefined}>
              <button
                type="button"
                data-template={t.id}
                disabled={disabled}
                onClick={() => onPick(t.id)}
                className="flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left outline-none transition duration-micro hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_12px_28px_-12px_rgba(76,29,149,0.28),0_2px_6px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-brand-400/60 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60"
              >
                {templates.scene(t.id)}
                <span className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                    {t.name}
                  </span>
                  <span className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t.description}
                  </span>
                  <span className="mt-auto self-start rounded-[5px] bg-slate-100 px-1.5 py-1 text-[11px] font-semibold leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {names.get(t.category) ?? t.category}
                  </span>
                </span>
              </button>
            </Tip>
          </li>
        ))}
      </ul>
    </section>
  );
}
