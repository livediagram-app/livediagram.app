'use client';

// A value inside a rule's summary (liveworkspace/docs/specs/018-automations/automations.md "Values"): a step's chip
// names what it writes (Take Snapshot “{{now.date}}”), and the braces are the rule's own syntax, never words for a
// person. Each value reads as its label (the one Insert a Value shows: Today, Space Name, Who Did It) in a value
// token, in the builder's chips and the Rules list's; Test Rule still fills it in.

import { useMemo } from 'react';
import { AUTOMATION_SHARED_VALUE_LABELS, dayShiftOf } from '@liveworkspace/automations';
import { useAutomationsKit } from './kit-context';

// A value in a text, braces and all.
const VALUE = /(\{\{[^{}]*\}\})/g;

/** The labels the app's Insert a Value names its values by, by value name. */
export type ValueLabels = ReadonlyMap<string, string>;

const SHARED: Readonly<Record<string, string>> = AUTOMATION_SHARED_VALUE_LABELS;

/** A value's label: the app's own, else every app's, a day shifted, a webhook field, or its name in words. */
export function valueLabel(name: string, labels?: ValueLabels): string {
  const known = labels?.get(name) ?? SHARED[name];
  if (known) return known;
  const shift = dayShiftOf(name);
  if (shift !== null) {
    const days = Math.abs(shift) === 1 ? '1 Day' : `${Math.abs(shift)} Days`;
    return shift === 0 ? SHARED['now.date']! : `Today ${shift > 0 ? '+' : '−'} ${days}`;
  }
  if (name.startsWith('webhook.')) return `Webhook ${name.slice('webhook.'.length)}`;
  return name
    .split(/[._\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

/** The text with each value as its label, for a name a screen reader or a menu reads. */
export function valueText(text: string, labels?: ValueLabels): string {
  return text.replace(VALUE, (v) => valueLabel(v.slice(2, -2).trim(), labels));
}

// The tint of a value token inside a chip: the value chips' own brand wash, a step lighter so it sits in the chip.
const TOKEN =
  'mx-px rounded bg-brand-100 px-1 text-brand-800 dark:bg-brand-500/25 dark:text-brand-100';

/** A chip's words, each value in them as a token of its label. */
export function ChipText({ text, labels }: { text: string; labels?: ValueLabels | undefined }) {
  if (!text.includes('{{')) return <>{text}</>;
  return (
    <>
      {text.split(VALUE).map((run, i) =>
        i % 2 === 1 ? (
          <span key={i} data-value-token={run.slice(2, -2).trim()} className={TOKEN}>
            {valueLabel(run.slice(2, -2).trim(), labels)}
          </span>
        ) : (
          run
        ),
      )}
    </>
  );
}

/** Every value the app's Insert a Value offers on this item, by name: read once per item outline. */
export function useValueLabels(outline: unknown): ValueLabels {
  const kit = useAutomationsKit();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const group of kit.values({ body: null, branch: false }, outline))
      for (const o of group.options) if (o.kind === 'value') map.set(o.name, o.label);
    return map;
  }, [kit, outline]);
}
