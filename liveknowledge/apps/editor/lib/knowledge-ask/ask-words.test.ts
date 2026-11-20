import { describe, expect, it } from 'vitest';
import { answerMarkdown, answerParts, answerWithoutMarkers, markedParts } from './answer-parts';
import { askFailureWords } from './ask-failure-words';
import { answerTrust } from './ask-trust';
import {
  RECENT_QUESTIONS_MAX,
  groupRecentQuestions,
  readRecentQuestions,
  recentQuestionsEverywhere,
  recentQuestionsKey,
  withQuestionRemembered,
  writeRecentQuestions,
} from './recent-questions';

describe('an answer cut into text and citations', () => {
  it('makes a chip of each marker that names a cited passage', () => {
    expect(
      answerParts('Ship on Thursdays [1]. Hotfixes any day [2, 3].', new Set([1, 2, 3])),
    ).toEqual([
      { kind: 'text', text: 'Ship on Thursdays' },
      { kind: 'cite', number: 1 },
      { kind: 'text', text: '. Hotfixes any day' },
      { kind: 'cite', number: 2 },
      { kind: 'cite', number: 3 },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves a marker that names no cited passage as the text it was', () => {
    expect(answerParts('See [4] and array[0].', new Set([1]))).toEqual([
      { kind: 'text', text: 'See [4] and array[0].' },
    ]);
  });

  it('keeps anything that looks like markup as characters', () => {
    const parts = answerParts('<img src=x onerror=alert(1)> **bold** [1]', new Set([1]));
    expect(parts[0]).toEqual({ kind: 'text', text: '<img src=x onerror=alert(1)> **bold**' });
  });

  it('takes the markers out for a page', () => {
    expect(answerWithoutMarkers('Ship on Thursdays [1]. Hotfixes [2, 3] too.')).toBe(
      'Ship on Thursdays. Hotfixes too.',
    );
  });

  it('writes Markdown with the pages it cites', () => {
    expect(answerMarkdown('Ship on Thursdays [1].', [{ number: 1, title: 'Release [v2]' }])).toBe(
      'Ship on Thursdays [1].\n\n## Sources\n\n1. Release \\[v2\\]',
    );
  });
});

describe('a passage with the matched parts marked', () => {
  it('marks words that begin with a content word of the question', () => {
    const parts = markedParts(
      'We release on Thursdays. Releases need a tick.',
      'When do we release?',
    );
    expect(parts.filter((p) => p.marked).map((p) => p.text)).toEqual(['release', 'Releases']);
    expect(parts.map((p) => p.text).join('')).toBe(
      'We release on Thursdays. Releases need a tick.',
    );
  });

  it('marks nothing for a question of common words, and reads symbols as text', () => {
    expect(markedParts('What is this?', 'what is this')).toEqual([
      { text: 'What is this?', marked: false },
    ]);
    expect(markedParts('a.b (c)', 'a.b* (c) [d]').every((p) => !p.marked)).toBe(true);
  });

  it('marks a 1,200 character passage against a long question in linear time', () => {
    const passage = 'release process hotfix '.repeat(55);
    const before = process.cpuUsage();
    for (let i = 0; i < 200; i++) markedParts(passage, 'release process hotfix deploy rollback');
    const spent = process.cpuUsage(before);
    if (process.env.MEASURE) console.log(`MEASURE marks ${(spent.user + spent.system) / 1000} ms`);
    // Measured at about 15 ms for the 200 runs; 400 ms is the guard.
    expect((spent.user + spent.system) / 1000).toBeLessThan(400);
  });
});

describe('the trust line', () => {
  const source = (tab: string, trust: 'verified' | 'review-due' | 'never-verified') => ({
    tab,
    trust,
  });
  it('counts pages, not passages', () => {
    expect(
      answerTrust([source('a', 'verified'), source('a', 'verified'), source('b', 'verified')]),
    ).toMatchObject({ pill: 'Answered From 2 Verified Pages', solid: true, rest: '' });
  });
  it('says what was unverified or due', () => {
    expect(
      answerTrust([
        source('a', 'verified'),
        source('b', 'review-due'),
        source('c', 'never-verified'),
      ]),
    ).toMatchObject({
      pill: 'Answered From 1 Verified Page',
      solid: false,
      rest: 'Of the others, 1 is due a review and 1 was never verified.',
    });
    expect(answerTrust([source('a', 'never-verified')])).toMatchObject({
      pill: 'Answered From 1 Page',
      rest: 'It was never verified.',
    });
    expect(answerTrust([source('a', 'review-due'), source('b', 'review-due')])).toMatchObject({
      pill: 'Answered From 2 Pages',
      rest: '2 are due a review.',
    });
  });
  it('is nothing for an answer that cites nothing', () => {
    expect(answerTrust([])).toBeNull();
  });
});

describe('a failure in words', () => {
  const KINDS = [
    'bad-key',
    'no-credit',
    'rate-limited',
    'overloaded',
    'model-unavailable',
    'refused',
    'person-limit',
    'knowledgebase-limit',
    'question-too-long',
    'no-question',
    'ask_unavailable',
    'sign_in_required',
    'network',
    'other',
    'something-new',
  ];
  it.each(KINDS)('%s has a title and a next step, and never a code', (kind) => {
    for (const manageAi of [true, false]) {
      const words = askFailureWords(kind, { manageAi });
      expect(words.title.length).toBeGreaterThan(8);
      expect(words.text.length).toBeGreaterThan(8);
      expect(`${words.title} ${words.text}`).not.toMatch(/\b[45]\d{2}\b|_|error|undefined/i);
    }
  });
  it('sends an Editor to AI Settings for a bad key and tells anyone else who can', () => {
    expect(askFailureWords('bad-key', { manageAi: true }).step).toBe('ai-settings');
    const other = askFailureWords('bad-key', { manageAi: false });
    expect(other.step).toBe('none');
    expect(other.text).toContain('Ask an Editor');
  });
  it('names the hourly and the daily limit', () => {
    expect(askFailureWords('person-limit', { manageAi: false }).title).toBe(
      'You Have Asked 20 Questions This Hour',
    );
    expect(askFailureWords('knowledgebase-limit', { manageAi: false }).title).toBe(
      'This Knowledgebase Has Had Its 200 Questions Today',
    );
  });
  it('offers to ask again only where asking again can help', () => {
    const again = (kind: string) => askFailureWords(kind, { manageAi: true }).step === 'ask-again';
    expect(['no-credit', 'rate-limited', 'overloaded', 'network', 'other'].every(again)).toBe(true);
    expect(['refused', 'person-limit', 'knowledgebase-limit', 'bad-key'].some(again)).toBe(false);
  });
});

describe('recent questions', () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
    };
  };
  const NOW = new Date(2026, 10, 20, 15, 0).getTime();
  const DAY = 86_400_000;

  it('keeps the newest first, each question once, 50 at most', () => {
    let list = withQuestionRemembered([], 'How do we release?', 1);
    list = withQuestionRemembered(list, 'Who is on call?', 2);
    list = withQuestionRemembered(list, '  how do we   RELEASE? ', 3);
    expect(list).toEqual([
      { question: 'how do we   RELEASE?', askedAt: 3 },
      { question: 'Who is on call?', askedAt: 2 },
    ]);
    for (let i = 0; i < 60; i++) list = withQuestionRemembered(list, `Question ${i}?`, 10 + i);
    expect(list).toHaveLength(RECENT_QUESTIONS_MAX);
    expect(list[0]!.question).toBe('Question 59?');
  });

  it('is kept per person and per knowledgebase', () => {
    const storage = memory();
    writeRecentQuestions(storage, 'me', 'd1', [{ question: 'One?', askedAt: 1 }]);
    expect(readRecentQuestions(storage, 'me', 'd1')).toEqual([{ question: 'One?', askedAt: 1 }]);
    expect(readRecentQuestions(storage, 'me', 'd2')).toEqual([]);
    expect(readRecentQuestions(storage, 'you', 'd1')).toEqual([]);
  });

  it('reads nothing from a store that throws or holds something else', () => {
    const storage = memory();
    storage.setItem(recentQuestionsKey('me', 'd1'), '{"not":"a list"}');
    expect(readRecentQuestions(storage, 'me', 'd1')).toEqual([]);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readRecentQuestions(broken, 'me', 'd1')).toEqual([]);
    expect(writeRecentQuestions(broken, 'me', 'd1', [])).toBe(false);
  });

  it('groups by Today, This Week and Earlier', () => {
    const groups = groupRecentQuestions(
      [
        { question: 'A?', askedAt: NOW - 3_600_000 },
        { question: 'B?', askedAt: NOW - 2 * DAY },
        { question: 'C?', askedAt: NOW - 6 * DAY },
        { question: 'D?', askedAt: NOW - 30 * DAY },
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.questions.map((q) => q.question)])).toEqual([
      ['Today', ['A?']],
      ['This Week', ['B?', 'C?']],
      ['Earlier', ['D?']],
    ]);
    expect(groupRecentQuestions([], NOW)).toEqual([]);
  });

  it('finds the newest across the knowledgebases in this browser', () => {
    const storage = memory();
    writeRecentQuestions(storage, 'me', 'd1', [{ question: 'One?', askedAt: 5 }]);
    writeRecentQuestions(storage, 'me', 'd2', [
      { question: 'Two?', askedAt: 9 },
      { question: 'one?', askedAt: 2 },
    ]);
    writeRecentQuestions(storage, 'you', 'd1', [{ question: 'Theirs?', askedAt: 99 }]);
    expect(recentQuestionsEverywhere(storage, 'me', 3)).toEqual([
      { question: 'Two?', askedAt: 9, documentId: 'd2' },
      { question: 'One?', askedAt: 5, documentId: 'd1' },
    ]);
  });
});
