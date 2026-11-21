// livediagram's own values (docs/specs/013-workspace/automations.md "Values of its own"): what a Poll Ended and a
// Question Asked rule's text may read, each from the event the room queued (triggers.ts names the keys). Pure.

import type { ItemEventData, ValueKind } from '@liveworkspace/automations/item';
import {
  POLL_ANSWERS_DATA,
  POLL_ENDED_EVENT,
  POLL_QUESTION_DATA,
  POLL_RESULTS_DATA,
  QUESTION_ASKED_EVENT,
  QUESTION_DATA,
} from './triggers';

const dataText = (data: ItemEventData | undefined, key: string): string => {
  const value = data?.[key];
  return value === undefined ? '' : String(value);
};

const fromData = (name: string, label: string, under: string, key: string = name): ValueKind => ({
  name,
  label,
  under: [under],
  fill: (ctx) => dataText(ctx.event.data, key),
});

/** livediagram's own values, in the order Insert a Value lists them. */
export const DOCUMENT_VALUES: readonly ValueKind[] = [
  fromData('poll.question', 'Poll Question', POLL_ENDED_EVENT, POLL_QUESTION_DATA),
  fromData('poll.results', 'Poll Results', POLL_ENDED_EVENT, POLL_RESULTS_DATA),
  fromData('poll.answers', 'Poll Answers', POLL_ENDED_EVENT, POLL_ANSWERS_DATA),
  fromData('question', 'Question', QUESTION_ASKED_EVENT, QUESTION_DATA),
];

/** A poll's tally as `{{poll.results}}` reads it: each option and its count, one a line, the most chosen first
 *  (options the same count keep the poll's own order). Never who answered what. */
export function pollResultLines(tally: readonly { option: string; count: number }[]): string {
  return tally
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((entry) => `${entry.option}: ${entry.count}`)
    .join('\n');
}
