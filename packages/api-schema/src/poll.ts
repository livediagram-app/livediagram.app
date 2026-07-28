// Live poll (spec/88): an ephemeral pulse-check carried entirely by the
// realtime room. Unlike the timer / dot-vote (spec/39) NONE of this is a
// `Tab` field — it never reaches D1, so the types live here beside the
// other wire DTOs rather than in @livediagram/diagram, and the tally
// helpers below are pure so the results panel and the clipboard export
// can't drift from one another.

// How participants answer. Every style reduces to a single string `value`
// on the wire, so one tally path serves all of them.
export type PollStyle = 'yesNo' | 'yesNoAbstain' | 'choice' | 'rating' | 'text';

export type LivePoll = {
  id: string;
  question: string;
  style: PollStyle;
  // Creator-defined answers for `choice`. Empty for every other style,
  // whose options are fixed (see pollOptionTokens).
  options: string[];
  startedAt: number;
};

// Input caps (spec/88). Enforced at the compose inputs AND re-checked when
// an op arrives, so a hand-crafted frame from a peer can't blow up the
// panel with a 10k-character question or fifty options.
export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 60;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 6;
export const POLL_TEXT_ANSWER_MAX = 280;

// The fixed answer sets. `choice` is the only style that reads the poll's
// own options; `text` has no tokens at all (answers are free-form, listed
// rather than counted).
const YES_NO = ['Yes', 'No'];
const YES_NO_ABSTAIN = ['Yes', 'No', 'Abstain'];
const RATINGS = ['1', '2', '3', '4', '5'];

// Every answer token a poll can receive, in display order. Empty for a
// free-text poll, which is the signal to render the answer list instead of
// a bar chart.
export function pollOptionTokens(poll: LivePoll): string[] {
  switch (poll.style) {
    case 'yesNo':
      return YES_NO;
    case 'yesNoAbstain':
      return YES_NO_ABSTAIN;
    case 'rating':
      return RATINGS;
    case 'choice':
      return poll.options;
    case 'text':
      return [];
  }
}

// Trim a poll to the caps and drop anything unusable. Returns null when
// the poll can't be salvaged (no question, or a choice poll without at
// least two options) so callers can ignore a malformed op outright.
export function sanitisePoll(poll: LivePoll): LivePoll | null {
  const question = poll.question.trim().slice(0, POLL_QUESTION_MAX);
  if (question.length === 0) return null;
  const options =
    poll.style === 'choice'
      ? poll.options
          .map((o) => o.trim().slice(0, POLL_OPTION_MAX))
          .filter((o) => o.length > 0)
          .slice(0, POLL_OPTIONS_MAX)
      : [];
  if (poll.style === 'choice' && options.length < POLL_OPTIONS_MIN) return null;
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
