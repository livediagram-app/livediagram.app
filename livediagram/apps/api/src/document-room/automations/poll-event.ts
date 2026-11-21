// Poll Ended (docs/specs/013-workspace/automations.md "Triggers of its own"; docs/specs/012-collaboration/live-poll.md):
// the tally the room holds when a facilitator ends the poll, as the event a rule hears. The question, each option
// and its count, and how many answered: never an answer's key, so never who answered what. The poll itself still
// leaves no trace on the document.
import {
  POLL_ANSWERS_DATA,
  POLL_ENDED_EVENT,
  POLL_QUESTION_DATA,
  POLL_RESULTS_DATA,
  pollResultLines,
} from '@livediagram/document/automations';
import { pollOptionTokens, type LivePoll } from '@livediagram/api-schema';
import type { ItemEvent, ItemEventData } from '@liveworkspace/automations/item';
import { cutTo } from '@liveworkspace/automations/room';

// The most lines and characters `{{poll.results}}` carries: a free-text poll's answers are grouped, the most given
// first, and the rest left out.
export const POLL_RESULT_LINES_MAX = 50;
export const POLL_RESULTS_MAX = 4000;

/** What a Poll Ended rule reads of the poll and its answers (`null`: skipped). */
export function pollEventData(
  poll: LivePoll,
  answers: Readonly<Record<string, string | null>>,
): ItemEventData {
  const counts = new Map<string, number>();
  // A poll with its own options lists every one, the unchosen at 0; a free-text poll lists what was written.
  for (const token of pollOptionTokens(poll)) counts.set(token, 0);
  let answered = 0;
  for (const key in answers) {
    const value = answers[key];
    if (value === null || value === undefined) continue;
    answered += 1;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const tally = [...counts].map(([option, count]) => ({ option, count }));
  const lines = pollResultLines(tally).split('\n').slice(0, POLL_RESULT_LINES_MAX).join('\n');
  return {
    [POLL_QUESTION_DATA]: poll.question,
    [POLL_RESULTS_DATA]: cutTo(lines, POLL_RESULTS_MAX),
    [POLL_ANSWERS_DATA]: answered,
  };
}

/** The event for a poll ended now by `by`. */
export function pollEndedEvent(
  poll: LivePoll,
  answers: Readonly<Record<string, string | null>>,
  who: Pick<ItemEvent, 'by' | 'role'>,
  now: number,
): ItemEvent {
  return {
    id: `poll:${poll.id}`,
    kind: POLL_ENDED_EVENT,
    at: now,
    ...who,
    data: pollEventData(poll, answers),
  };
}
