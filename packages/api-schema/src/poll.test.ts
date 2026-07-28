import { describe, expect, it } from 'vitest';
import {
  POLL_OPTIONS_MAX,
  POLL_QUESTION_MAX,
  POLL_TEXT_ANSWER_MAX,
  formatPollResults,
  pollOptionTokens,
  sanitisePoll,
  sanitisePollAnswer,
  tallyPoll,
  type LivePoll,
  type PollStyle,
} from './poll';

const poll = (style: PollStyle, options: string[] = []): LivePoll => ({
  id: 'p1',
  question: 'Ship it?',
  style,
  options,
  startedAt: 0,
});

const answers = (...values: (string | null)[]) =>
  new Map(values.map((v, i) => [`sender-${i}`, v] as const));

describe('pollOptionTokens', () => {
  it('gives each style its answer set, and free text none', () => {
    expect(pollOptionTokens(poll('yesNo'))).toEqual(['Yes', 'No']);
    expect(pollOptionTokens(poll('yesNoAbstain'))).toEqual(['Yes', 'No', 'Abstain']);
    expect(pollOptionTokens(poll('rating'))).toEqual(['1', '2', '3', '4', '5']);
    expect(pollOptionTokens(poll('choice', ['A', 'B']))).toEqual(['A', 'B']);
    // No tokens is the signal to render an answer list, not a bar chart.
    expect(pollOptionTokens(poll('text'))).toEqual([]);
  });
});

describe('sanitisePoll', () => {
  it('trims the question to the cap and rejects an empty one', () => {
    const long = { ...poll('yesNo'), question: 'q'.repeat(POLL_QUESTION_MAX + 50) };
    expect(sanitisePoll(long)?.question).toHaveLength(POLL_QUESTION_MAX);
    expect(sanitisePoll({ ...poll('yesNo'), question: '   ' })).toBeNull();
  });

  it('caps choice options, drops blanks, and rejects fewer than two', () => {
    const many = poll(
      'choice',
      Array.from({ length: POLL_OPTIONS_MAX + 4 }, (_, i) => `opt ${i}`),
    );
    expect(sanitisePoll(many)?.options).toHaveLength(POLL_OPTIONS_MAX);
    expect(sanitisePoll(poll('choice', ['A', 'B', '  ', '']))?.options).toEqual(['A', 'B']);
    // Blanks dropped leaves one real option, which isn't a choice at all.
    expect(sanitisePoll(poll('choice', ['A', '  ', '']))).toBeNull();
    expect(sanitisePoll(poll('choice', ['A']))).toBeNull();
  });

  it('clears options on styles that own their answer set', () => {
    expect(sanitisePoll({ ...poll('yesNo'), options: ['junk'] })?.options).toEqual([]);
  });
});

describe('sanitisePollAnswer', () => {
  it('keeps null (a skip) as null', () => {
    expect(sanitisePollAnswer(poll('yesNo'), null)).toBeNull();
  });

  it('discards a token the poll never offered, so no fake bar can be injected', () => {
    expect(sanitisePollAnswer(poll('yesNo'), 'Maybe')).toBeNull();
    expect(sanitisePollAnswer(poll('yesNo'), 'Yes')).toBe('Yes');
    expect(sanitisePollAnswer(poll('choice', ['A', 'B']), 'B')).toBe('B');
    expect(sanitisePollAnswer(poll('choice', ['A', 'B']), 'C')).toBeNull();
  });

  it('trims free text to the cap and treats whitespace-only as a skip', () => {
    expect(sanitisePollAnswer(poll('text'), '  hi  ')).toBe('hi');
    expect(sanitisePollAnswer(poll('text'), '   ')).toBeNull();
    expect(sanitisePollAnswer(poll('text'), 'x'.repeat(400))).toHaveLength(POLL_TEXT_ANSWER_MAX);
  });
});

describe('tallyPoll', () => {
  it('counts each token and shares out of the ANSWERS, not the responses', () => {
    // 2 Yes, 1 No, 1 skip -> shares are over 3 answers, not 4 responses.
    const r = tallyPoll(poll('yesNo'), answers('Yes', 'Yes', 'No', null));
    expect(r.answered).toBe(3);
    expect(r.skipped).toBe(1);
    expect(r.rows).toEqual([
      { token: 'Yes', count: 2, share: 2 / 3 },
      { token: 'No', count: 1, share: 1 / 3 },
    ]);
  });

  it('keeps zero-count options on the chart so the full choice set stays visible', () => {
    const r = tallyPoll(poll('yesNoAbstain'), answers('Yes'));
    expect(r.rows.map((row) => [row.token, row.count])).toEqual([
      ['Yes', 1],
      ['No', 0],
      ['Abstain', 0],
    ]);
  });

  it('one sender changing their mind replaces their answer rather than stacking', () => {
    // The Map is keyed by sender, which is what enforces this.
    const collected = new Map([
      ['ann', 'No'],
      ['bob', 'Yes'],
    ]);
    collected.set('ann', 'Yes');
    const r = tallyPoll(poll('yesNo'), collected);
    expect(r.rows[0]).toEqual({ token: 'Yes', count: 2, share: 1 });
    expect(r.answered).toBe(2);
  });

  it('nobody answering leaves zero shares rather than dividing by zero', () => {
    const r = tallyPoll(poll('yesNo'), answers(null, null));
    expect(r.answered).toBe(0);
    expect(r.skipped).toBe(2);
    expect(r.rows.every((row) => row.share === 0)).toBe(true);
  });

  it('collects free text in arrival order and leaves the rows empty', () => {
    const r = tallyPoll(poll('text'), answers('slower', null, 'more colour'));
    expect(r.textAnswers).toEqual(['slower', 'more colour']);
    expect(r.rows).toEqual([]);
    expect(r.skipped).toBe(1);
  });
});

describe('formatPollResults', () => {
  it('writes the question, per-option percentages, and the response split', () => {
    const text = formatPollResults(poll('yesNo'), answers('Yes', 'Yes', 'No', null));
    expect(text).toBe('Ship it?\n\nYes: 2 (67%)\nNo: 1 (33%)\n\n3 answered, 1 skipped');
  });

  it('lists free-text answers instead of counts', () => {
    const text = formatPollResults(poll('text'), answers('slower', 'more colour'));
    expect(text).toBe('Ship it?\n\n- slower\n- more colour\n\n2 answered, 0 skipped');
  });

  it('says so when a free-text poll got nothing', () => {
    expect(formatPollResults(poll('text'), answers(null))).toContain('(no answers)');
  });

  it('carries no participant identity, matching the on-screen panel', () => {
    const text = formatPollResults(poll('yesNo'), answers('Yes', 'No'));
    expect(text).not.toContain('sender-0');
    expect(text).not.toContain('sender-1');
  });
});
