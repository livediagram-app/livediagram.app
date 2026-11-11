'use client';

// The Preview under a comment, an email or a message's panel (docs/specs/026-plan/automations.md "Values"): the text
// as it would read on a real card of the plan, posted as Automation (a message, by the webhook it posts through).
// Inside a branch the plan's first card stands in for the related card and its second for the one that started the
// rule. Nothing to preview on a plan with no cards.

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
  trigger?: PreviewContext['trigger'],
): PreviewContext {
  const status = itemStatus(card);
  return {
    ...(trigger ? { trigger } : {}),
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
  branch = false,
  via,
}: {
  text: string;
  outline: AutomationOutline;
  rule: string;
  // Whoever is building the rule stands in for the person who triggers it.
  person: string;
  now: number;
  // Text in a For Related Cards branch: {{trigger.…}} reads too.
  branch?: boolean;
  // A message's preview names where it posts in place of the rule.
  via?: string | undefined;
}) {
  const cardLink = usePlan()?.cardLink;
  const cards = outline.items.values();
  const card = cards.next().value;
  if (!card || !text.trim()) return null;
  const starter = branch ? (cards.next().value ?? card) : undefined;
  const filled = previewText(
    text,
    contextFor(
      card,
      outline,
      rule,
      person,
      now,
      cardLink?.(card.id) ?? '',
      starter
        ? { title: itemTitle(starter), key: starter.key, link: cardLink?.(starter.id) ?? '' }
        : undefined,
    ),
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
            <span className="font-normal text-slate-500 dark:text-slate-400">· {via ?? rule}</span>
          </span>
          <span className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
            {filled}
          </span>
        </div>
      </div>
    </div>
  );
}
