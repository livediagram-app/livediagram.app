// The values an item's rules fill in (liveworkspace/docs/specs/018-automations/automations.md "Values"; blueprint
// item-engine.md "The shared kinds"): the item's and the run's tab's name and link, a comment trigger's text and a
// Summarise step's summary, beside the ones every app shares (values.ts). Which a text may hold at a place, what
// Insert a Value offers there, and how a run reads them. Pure.

import {
  AUTOMATION_SHARED_VALUE_LABELS,
  AUTOMATION_SHARED_VALUE_NAMES,
  isSharedValue,
  sharedValue,
} from '../values';
import { WEBHOOK_VALUE_PREFIX, type WebhookValue } from '../webhook-paths';
import type { ItemKinds, ItemValueContext, ValueKind } from './kinds';
import { itemWordTitle } from './names';
import type { ItemEventData, ItemPart, ItemWord } from './types';

const dataText = (data: ItemEventData | undefined, key: string): string => {
  const value = data?.[key];
  return value === undefined ? '' : String(value);
};

/** The values every app has, their chips named after the app's word for the item. */
export function sharedValues(itemWord: ItemWord): ValueKind[] {
  const item = itemWordTitle(itemWord);
  return [
    { name: 'item.name', label: `${item} Name`, fill: (ctx) => ctx.outline.name },
    { name: 'item.url', label: `${item} Link`, fill: (ctx) => ctx.outline.url },
    {
      name: 'tab.name',
      label: 'Tab Name',
      // A tab since removed still reads the name its event kept.
      fill: (ctx) => ctx.tab?.name ?? dataText(ctx.event.data, 'tab.name'),
    },
    { name: 'tab.url', label: 'Tab Link', fill: (ctx) => ctx.tab?.url ?? '' },
    {
      name: 'comment',
      label: 'Comment',
      under: ['comment_added'],
      fill: (ctx) => dataText(ctx.event.data, 'comment'),
    },
    { name: 'summary', label: 'AI Summary', afterAi: true, fill: (ctx) => ctx.summary },
  ];
}

// Where in a rule a text stands: under which trigger, and whether a Summarise step comes before it.
export type ItemValuePlace = { trigger: ItemPart; afterAi: boolean };

/** Whether a text at `place` may hold `{{name}}`. */
export function itemValueKnown(kinds: ItemKinds, place: ItemValuePlace, name: string): boolean {
  if (isSharedValue(name, { webhook: place.trigger.kind === 'incoming_webhook' })) return true;
  const value = kinds.value(name);
  if (!value || (value.under && !value.under.includes(place.trigger.kind))) return false;
  return !value.afterAi || place.afterAi;
}

/** What Insert a Value offers at `place`, in order: the app's and the item's, then the ones every app shares. An
 *  Incoming Webhook rule's `webhook.<path>` is typed, never listed. */
export function itemValueOptions(
  kinds: ItemKinds,
  place: ItemValuePlace,
): { name: string; label: string }[] {
  const personless = kinds.trigger(place.trigger.kind)?.personless === true;
  return [
    ...kinds.values
      .filter((v) => itemValueKnown(kinds, place, v.name))
      .map((v) => ({ name: v.name, label: v.label })),
    ...AUTOMATION_SHARED_VALUE_NAMES.filter((name) => name !== 'person' || !personless).map(
      (name) => ({ name, label: AUTOMATION_SHARED_VALUE_LABELS[name] }),
    ),
  ];
}

// What a run reads its values from.
export interface ItemFillContext extends ItemValueContext {
  rule: { name: string };
  now: number;
  timeZone: string;
  // The app's own values for this event, read by its room.
  own?: Readonly<Record<string, string>>;
}

/** How a run reads `{{name}}`: a shared name, then the app's room's, then the kind's own fill; nothing otherwise. */
export function itemValueResolver(
  kinds: ItemKinds,
  ctx: ItemFillContext,
): (name: string) => string {
  const webhook: Record<string, WebhookValue> = {};
  for (const [key, value] of Object.entries(ctx.event.data ?? {}))
    if (key.startsWith(WEBHOOK_VALUE_PREFIX))
      webhook[key.slice(WEBHOOK_VALUE_PREFIX.length)] = value;
  const shared = {
    person: ctx.event.by?.name ?? '',
    rule: ctx.rule.name,
    now: ctx.now,
    timeZone: ctx.timeZone,
    webhook,
  };
  return (name) => {
    const known = sharedValue(name, shared);
    if (known !== undefined) return known;
    if (ctx.own && Object.hasOwn(ctx.own, name)) return ctx.own[name]!;
    return kinds.value(name)?.fill(ctx) ?? '';
  };
}
