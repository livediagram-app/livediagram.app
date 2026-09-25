// Live poll (spec/88): an ephemeral pulse-check carried entirely by the
// realtime room. Unlike the timer / dot-vote (spec/39) NONE of this is a
// `Tab` field — it never reaches D1, so the types live here beside the
// other wire DTOs rather than in @livediagram/diagram, and the tally
// helpers below are pure so the results panel and the clipboard export
// can't drift from one another.

// How participants answer. Every style reduces to a single string `value`
// on the wire, so one tally path serves all of them.
//
// The union itself lives in @livediagram/diagram (`poll-style.ts`), one
// package down, because a Session button (spec/105) STORES a style on the
// element and `SessionButtonConfig` is a `Tab` field. Re-exported here so
// every existing `import { PollStyle } from '@livediagram/api-schema'`
// keeps resolving and there is still only one list.
import {
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  pollStyleCarriesOptions,
  pollStyleTokens,
  type PollStyle,
} from '@livediagram/diagram';

export type { PollStyle };
// Re-exported, not redefined: the numbers live one package down so the Session
// button's editor reads the same two the Studio does. See poll-style.ts.
export { POLL_OPTIONS_MAX, POLL_OPTIONS_MIN };

export type LivePoll = {
  id: string;
  question: string;
  style: PollStyle;
  // The poll's own answer list: written by the author for `choice`, frozen
  // from the room's roster at start for `collaborators` (spec/88). Empty for
  // every other style, whose options are fixed (see pollOptionTokens).
  options: string[];
  startedAt: number;
};

// Input caps (spec/88). Enforced at the compose inputs AND re-checked when
// an op arrives, so a hand-crafted frame from a peer can't blow up the
// panel with a 10k-character question or fifty options.
export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 60;
export const POLL_TEXT_ANSWER_MAX = 280;

// Every answer token a poll can receive, in display order. Empty for a
// free-text poll, which is the signal to render the answer list instead of
// a bar chart. The fixed sets live with the style union in
// @livediagram/diagram, so the authoring menus can preview a style's answers
// before any poll exists without a second copy of "Yes / No".
export function pollOptionTokens(poll: LivePoll): string[] {
  return pollStyleTokens(poll.style, poll.options);
}

// Trim a poll to the caps and drop anything unusable. Returns null when
// the poll can't be salvaged (no question, or a poll that carries its own
// answer list without at least two entries) so callers can ignore a
// malformed op outright.
//
// `pollStyleCarriesOptions`, not `style === 'choice'`: a `collaborators`
// poll's list is generated from the room rather than typed, but by the time
// it reaches here it has been frozen into `options` and deserves exactly the
// same trimming and floor. Asking the narrower question would have let a
// roster poll through with fifty names and no minimum.
export function sanitisePoll(poll: LivePoll): LivePoll | null {
  const question = poll.question.trim().slice(0, POLL_QUESTION_MAX);
  if (question.length === 0) return null;
  const carriesOptions = pollStyleCarriesOptions(poll.style);
  const options = carriesOptions
    ? poll.options
        .map((o) => o.trim().slice(0, POLL_OPTION_MAX))
        // An option IS its answer token, so two equal options are one answer
        // shown twice: each row tallies every vote for it (shares past 100%),
        // the prompt renders two buttons under one React key, and "A, A"
        // passed the two-answer floor offering a single choice.
        .filter((o, i, all) => o.length > 0 && all.indexOf(o) === i)
        .slice(0, POLL_OPTIONS_MAX)
    : [];
  if (carriesOptions && options.length < POLL_OPTIONS_MIN) return null;
  return { ...poll, question, options };
}

// Trim an incoming answer to something renderable, or null (= skipped).
// A token answer that isn't one of the poll's own options is discarded
// rather than displayed, so a peer can't inject a fake bar into the chart.
export function sanitisePollAnswer(poll: LivePoll, value: string | null): string | null {
  if (value === null) return null;
  if (poll.style === 'text') {
    const text = value.trim().slice(0, POLL_TEXT_ANSWER_MAX);
    return text.length > 0 ? text : null;
  }
  return pollOptionTokens(poll).includes(value) ? value : null;
}

export type PollTallyRow = {
  token: string;
  count: number;
  // Share of the ANSWERS (skips excluded), 0-1. Zero when nobody answered.
  share: number;
};

export type PollResults = {
  rows: PollTallyRow[];
  // Free-text answers in arrival order. Always empty for a token poll.
  textAnswers: string[];
  // People who answered with a value, and people who explicitly skipped.
  answered: number;
  skipped: number;
};

// Tally the collected answers. `answers` is keyed by sender so a
// participant who changes their mind replaces their earlier answer instead
// of stacking a second one — the keys are never surfaced in the UI
// (spec/88: results are not attributed to people).
export function tallyPoll(poll: LivePoll, answers: Map<string, string | null>): PollResults {
  const tokens = pollOptionTokens(poll);
  const counts = new Map<string, number>(tokens.map((t) => [t, 0]));
  const textAnswers: string[] = [];
  let answered = 0;
  let skipped = 0;
  for (const value of answers.values()) {
    if (value === null) {
      skipped++;
      continue;
    }
    answered++;
    if (poll.style === 'text') {
      textAnswers.push(value);
    } else if (counts.has(value)) {
      counts.set(value, counts.get(value)! + 1);
    }
  }
  const rows = tokens.map((token) => {
    const count = counts.get(token) ?? 0;
    return { token, count, share: answered > 0 ? count / answered : 0 };
  });
  return { rows, textAnswers, answered, skipped };
}

// Plain-text results for the host's clipboard copy (spec/88). This is the
// only way a poll outlives itself, so it carries the question and the
// counts — but no participant identity, matching the on-screen panel.
export function formatPollResults(poll: LivePoll, answers: Map<string, string | null>): string {
  const { rows, textAnswers, answered, skipped } = tallyPoll(poll, answers);
  const lines = [poll.question, ''];
  if (poll.style === 'text') {
    if (textAnswers.length === 0) lines.push('(no answers)');
    for (const text of textAnswers) lines.push(`- ${text}`);
  } else {
    for (const row of rows) {
      lines.push(`${row.token}: ${row.count} (${Math.round(row.share * 100)}%)`);
    }
  }
  lines.push('');
  lines.push(`${answered} answered, ${skipped} skipped`);
  return lines.join('\n');
}
