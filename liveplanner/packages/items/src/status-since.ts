// When a card entered its current status, and its Age read from that (docs/specs/026-plan/items.md "Fields",
// item-types.md "Card display"). Every item write passes through apply.ts, which stamps the moment here, so the
// editor, the api, agents, the CLI and form responses all keep it the same way.

import type { Item, ItemFields } from './item';
import { STATUS_SINCE_FIELD, itemStatus } from './item';
import { DAY_MS } from './plan-view-dates';

// Age turns amber from this many days in one status, and red from CARD_AGE_ALERT_DAYS, Stale Cards' threshold.
export const CARD_AGE_WARN_DAYS = 7;
export const CARD_AGE_ALERT_DAYS = 14;

export type CardAgeTone = 'quiet' | 'warn' | 'alert';

// A stored value as a moment: a finite whole ms epoch, not negative.
export function isStatusSince(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

// When the card entered its status: its stamp, else (a card stored before the stamp existed) its last change.
export function itemStatusSince(item: Pick<Item, 'fields' | 'updatedAt'>): number {
  const v = item.fields[STATUS_SINCE_FIELD];
  return isStatusSince(v) ? v : item.updatedAt;
}

// The fields a write leaves, stamped (blueprints/item-store.md "apply.ts"): a write that names the stamp keeps it
// (an undo, a restore, a sync); a create or a change of status takes `now`; any other write on a card without one
// keeps the card's previous last change, so an older card's age never restarts on an edit.
export function stampStatusSince(
  before: Pick<Item, 'fields' | 'updatedAt'> | undefined,
  fields: ItemFields,
  written: boolean,
  now: number,
): ItemFields {
  if (written && isStatusSince(fields[STATUS_SINCE_FIELD])) return fields;
  const out = { ...fields };
  if (!before || itemStatus(before) !== itemStatus({ fields })) out[STATUS_SINCE_FIELD] = now;
  else out[STATUS_SINCE_FIELD] = itemStatusSince(before);
  return out;
}

// What an inverse write puts back for a write that moved `before` from `status` to another: its old stamp, or
// nothing when the write keeps its status.
export function statusSinceUndo(
  before: Pick<Item, 'fields' | 'updatedAt'>,
  nextStatus: string | undefined,
): ItemFields {
  return itemStatus(before) === nextStatus ? {} : { [STATUS_SINCE_FIELD]: itemStatusSince(before) };
}

// Whole local calendar days from `since` to `today`: 0 on the day it arrived, 1 from the next local midnight. Never
// negative (a clock running behind another's).
export function cardAgeDays(since: number, today: Date): number {
  const from = new Date(since);
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // Rounded: a day across a clock change is 23 or 25 hours long.
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

export function cardAgeTone(days: number): CardAgeTone {
  return days >= CARD_AGE_ALERT_DAYS ? 'alert' : days >= CARD_AGE_WARN_DAYS ? 'warn' : 'quiet';
}

// The Age as a card reads it ("4d"), and as it is spoken ("In Doing for 4 days").
export function cardAgeText(days: number): string {
  return `${days}d`;
}

export function cardAgeLabel(days: number, status: string): string {
  return `In ${status} for ${days === 1 ? '1 day' : `${days} days`}`;
}
