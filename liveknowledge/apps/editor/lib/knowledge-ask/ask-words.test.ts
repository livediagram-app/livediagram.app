import { describe, expect, it } from 'vitest';
import { answerMarkdown, answerParts, answerWithoutMarkers, markedParts } from './answer-parts';
import { askFailureWords, refusalKind } from './ask-failure-words';
import { answerTrust } from './ask-trust';
import {
  CHATS_MAX_CHARS,
  RECENT_QUESTIONS_MAX,
  chatIdOf,
  completedQuestions,
  groupRecentQuestions,
  readRecentQuestions,
  recentQuestionsEverywhere,
  recentQuestionsKey,
  withChatChanged,
  withChatRemoved,
  withChatSaved,
  writeRecentQuestions,
  type RecentQuestion,
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
    // Measured at about 11 ms for the 200 runs; 400 ms is the guard.
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
  it('is nothing where verification is off (a Review Period of Never)', () => {
    expect(
      answerTrust([
        { tab: 'a', trust: 'off' },
        { tab: 'b', trust: 'off' },
      ]),
    ).toBeNull();
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
    'team-key-unreadable',
    'personal-key-unreadable',
    'key-settings-unreachable',
    'ai_credits_used',
    'ai_by_others_limit',
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
  it('says the reason an ask_unavailable refusal names, never another reason’s words', () => {
    // A personal knowledgebase with no key, accounts out of reach: never "your team's stored key".
    const kind = refusalKind({ error: 'ask_unavailable', reason: 'shared-unavailable' }, 'other');
    expect(kind).toBe('key-settings-unreachable');
    expect(askFailureWords(kind, { manageAi: true })).toEqual({
      title: 'Ask Is Not Available Right Now',
      text: "Your AI key settings couldn't be reached just now. Ask again in a moment.",
      step: 'ask-again',
    });
    expect(refusalKind({ error: 'ask_unavailable', reason: 'team-unreadable' }, 'other')).toBe(
      'team-key-unreadable',
    );
    expect(askFailureWords('personal-key-unreadable', { manageAi: true }).text).toBe(
      'Your AI key could not be read. Replace it in Settings, under AI.',
    );
    // The knowledgebase's own key, or an api that names no reason.
    expect(refusalKind({ error: 'ask_unavailable', reason: 'unreadable' }, 'other')).toBe(
      'ask_unavailable',
    );
    expect(refusalKind({ error: 'ask_unavailable' }, 'other')).toBe('ask_unavailable');
    expect(askFailureWords('ask_unavailable', { manageAi: true }).text).toBe(
      "This knowledgebase's AI key could not be read. Replace it in AI Settings.",
    );
    expect(refusalKind({ error: 'person-limit' }, 'other')).toBe('person-limit');
    expect(refusalKind(null, 'forbidden')).toBe('forbidden');
  });
  it('says the month’s credits are used, never that something went wrong', () => {
    const words = askFailureWords('ai_credits_used', { manageAi: true });
    expect(words.title).toBe("This Month's AI Credits Are Used");
    expect(words.text).toMatch(/^They start again on 1 [A-Z][a-z]+\.$/);
    expect(words.step).toBe('none');
    expect(askFailureWords('ai_by_others_limit', { manageAi: false }).text).toContain(
      'Try again tomorrow',
    );
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

  it('keeps each chat once, the one asked in last first, 50 at most and within its characters', () => {
    const chat = (id: string, askedAt: number, extra: Partial<RecentQuestion> = {}) => ({
      id,
      question: `${id}?`,
      askedAt,
      ...extra,
    });
    let list = withChatSaved([], chat('a', 1));
    list = withChatSaved(list, chat('b', 2));
    list = withChatSaved(list, chat('a', 3));
    expect(list.map((row) => [row.id, row.askedAt])).toEqual([
      ['a', 3],
      ['b', 2],
    ]);
    for (let i = 0; i < 60; i++) list = withChatSaved(list, chat(`q${i}`, 10 + i));
    expect(list).toHaveLength(RECENT_QUESTIONS_MAX);
    expect(list[0]!.id).toBe('q59');
    // Over the characters, the oldest go first, never the one just saved.
    const big = (id: string) =>
      chat(id, 1, {
        turns: [
          {
            id,
            question: id,
            status: 'done',
            text: 'x'.repeat(CHATS_MAX_CHARS / 3),
            sources: [],
            notUsed: [],
            gaps: [],
            model: 'm',
          },
        ],
      });
    let heavy = withChatSaved([], big('h1'));
    heavy = withChatSaved(heavy, big('h2'));
    heavy = withChatSaved(heavy, big('h3'));
    expect(heavy.map((row) => row.id)).toEqual(['h3', 'h2']);
    const huge = chat('huge', 1, { question: 'y'.repeat(CHATS_MAX_CHARS + 1) });
    expect(withChatSaved(heavy, huge).map((row) => row.id)).toEqual(['huge']);
  });

  it('accepts, reopens and deletes a chat; a question kept before chats has an id of its own', () => {
    const list: RecentQuestion[] = [
      { id: 'a', question: 'A?', askedAt: 5 },
      { question: 'Old?', askedAt: 2 },
    ];
    expect(chatIdOf(list[1]!)).toBe('asked:2');
    const accepted = withChatChanged(list, 'a', (row) => ({ ...row, completedAt: 9 }));
    expect(
      groupRecentQuestions(accepted, 10).flatMap((g) => g.questions.map((q) => q.question)),
    ).toEqual(['Old?']);
    expect(
      completedQuestions([
        ...accepted,
        { id: 'c', question: 'C?', askedAt: 1, completedAt: 20 },
      ]).map((r) => r.id),
    ).toEqual(['c', 'a']);
    expect(withChatRemoved(accepted, 'asked:2').map((row) => row.id)).toEqual(['a']);
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
