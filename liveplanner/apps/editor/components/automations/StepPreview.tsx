'use client';

// The Preview under a comment or an email's panel (docs/specs/026-plan/automations.md "Values"): the text as it
// would read on a real card of the plan, posted as Automation. Nothing to preview on a plan with no cards.

import { itemStatus, itemTitle, type Item } from '@liveplanner/items';
import { usePlan } from '@/components/plan/PlanContext';
import type { AutomationOutline } from './automation-outline';
import { AutomationDisc } from './automation-glyphs';
import { previewText, type PreviewContext } from './preview-values';

function contextFor(
  card: Item,
  outline: AutomationOutline,
  rule: string,
  person: string,
  now: number,
  link: string,
): PreviewContext {
  const status = itemStatus(card);
  return {
    card,
    column: (status && outline.statuses.get(status)) ?? '',
    link,
    people: outline.people,
    person,
    rule,
    now,
    fieldByName: (name) => {
      for (const t of outline.types) {
        const f = t.custom?.find((c) => c.label === name);
        if (!f) continue;
        const v = card.fields[f.id];
        return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
      }
      return '';
    },
  };
}

export function StepPreview({
  text,
  outline,
  rule,
  person,
  now,
}: {
  text: string;
  outline: AutomationOutline;
  rule: string;
  // Whoever is building the rule stands in for the person who triggers it.
  person: string;
  now: number;
}) {
  const cardLink = usePlan()?.cardLink;
  const card = outline.items.values().next().value;
  if (!card || !text.trim()) return null;
  const filled = previewText(
    text,
    contextFor(card, outline, rule, person, now, cardLink?.(card.id) ?? ''),
  );
  return (
    <div data-step-preview="" className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Preview on #{card.key} {itemTitle(card)}
      </span>
      <div className="flex gap-2.5 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:ring-brand-500/20">
        <AutomationDisc />
        <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
          <span className="font-semibold text-slate-900 dark:text-slate-50">
            Automation{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">· {rule}</span>
          </span>
          <span className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
            {filled}
          </span>
        </div>
      </div>
    </div>
  );
}
