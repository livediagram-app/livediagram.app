// livehuddle's own values (docs/specs/013-workspace/automations.md "Values of its own"): what an Everyone Left and a
// Suggestion Dropped rule's text may read, each from the event the room queued (triggers.ts names the keys). Pure.

import type { ItemEventData, ValueKind } from '@liveworkspace/automations/item';
import {
  EVERYONE_LEFT_TRIGGER,
  SUGGESTION_DATA,
  SUGGESTION_DROPPED_EVENT,
  VISIT_COUNT_DATA,
  VISIT_MINUTES_DATA,
  VISIT_PEOPLE_DATA,
} from './triggers';

const dataText = (data: ItemEventData | undefined, key: string): string => {
  const value = data?.[key];
  return value === undefined ? '' : String(value);
};

const fromData = (name: string, label: string, under: string): ValueKind => ({
  name,
  label,
  under: [under],
  fill: (ctx) => dataText(ctx.event.data, name),
});

/** livehuddle's own values, in the order Insert a Value lists them. */
export const SPACE_VALUES: readonly ValueKind[] = [
  fromData(VISIT_PEOPLE_DATA, 'Who Was There', EVERYONE_LEFT_TRIGGER),
  fromData(VISIT_COUNT_DATA, 'How Many Were There', EVERYONE_LEFT_TRIGGER),
  fromData(VISIT_MINUTES_DATA, 'Minutes There', EVERYONE_LEFT_TRIGGER),
  fromData(SUGGESTION_DATA, 'Suggestion', SUGGESTION_DROPPED_EVENT),
];
