import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  articleReadability,
  fleschReadingEase,
  LONG_SENTENCE_WORDS,
  READING_LEVEL_LABEL,
  readabilityDetail,
  readabilityOfTexts,
  readingLevelOf,
  readingMinutesFor,
  readingTimeLabel,
  sentencesOf,
  syllablesOf,
} from './article-readability';
import type { ArticleBlock } from './article-flow';

// docs/specs/007-editor/article-pages.md "Word Count": reading time, sentences, and how easily the writing reads.
const words = (s: string) => sentencesOf(s).map((x) => x.words);

describe('sentencesOf', () => {
  it('ends a sentence at a stop, a bang, a question and an ellipsis, closers included', () => {
    expect(words('One two. Three four! Five six? Seven… Eight nine.')).toEqual([2, 2, 2, 1, 2]);
    expect(words('He said "go." Then left.')).toEqual([3, 2]);
    expect(words('Wait... Then go.')).toEqual([1, 2]);
    // Where each starts and ends in the text.
    const [a, b] = sentencesOf('Hi there. Bye now.');
    expect([a!.start, a!.end, b!.start, b!.end]).toEqual([0, 9, 10, 18]);
  });

  it('never ends one after an abbreviation, an initial or inside a number', () => {
    expect(words('Dr. Smith met Mr. Jones today.')).toEqual([6]);
    expect(words('Use a tool, e.g. A hammer, then stop.')).toEqual([8]);
    expect(words('J. Smith wrote it.')).toEqual([4]);
    expect(words('It rose 3.5 points. Then it fell.')).toEqual([4, 3]);
    expect(words('See Fig. 3 for more.')).toEqual([5]);
    // A dotted number at a sentence's end still ends it.
    expect(words('It rose to 3.5. Then it fell.')).toEqual([4, 3]);
  });

  it('carries on past a stop a lower-case word follows, and ends before a number or a capital', () => {
    expect(words('Apples, pears etc. and more.')).toEqual([5]);
    expect(words('The year ended. 2020 began.')).toEqual([3, 2]);
    expect(words('Stop. – Then go.')).toEqual([1, 2]);
  });

  it('counts words holding a letter or digit, and ends the text', () => {
    expect(words('A – dash and 42 numbers')).toEqual([5]);
    expect(sentencesOf('')).toEqual([]);
    expect(sentencesOf('  … ! ')).toEqual([]);
    expect(words('"Quoted."')).toEqual([1]);
  });
});

describe('syllablesOf', () => {
  it('counts groups of vowels, a silent final e, and at least one', () => {
    expect(syllablesOf('cat')).toBe(1);
    expect(syllablesOf('make')).toBe(1);
    expect(syllablesOf('the')).toBe(1);
    expect(syllablesOf('table')).toBe(2);
    expect(syllablesOf('agree')).toBe(2);
    expect(syllablesOf('reading')).toBe(2);
    expect(syllablesOf('Readability,')).toBe(5);
    expect(syllablesOf('rhythm')).toBe(1);
    expect(syllablesOf('42')).toBe(1);
    expect(syllablesOf('le')).toBe(1);
  });
});

describe('Flesch Reading Ease', () => {
  it("scores Flesch's own worked example, the cat on the mat, at 116", () => {
    expect(Math.round(fleschReadingEase(6, 1, 6))).toBe(116);
    expect(readabilityOfTexts(['The cat sat on the mat.'], 6)).toMatchObject({
      sentences: 1,
      wordsPerSentence: 6,
      ease: 116.1,
      level: 'easy',
    });
  });

  it('says the level in Flesch bands', () => {
    expect(readingLevelOf(100)).toBe('easy');
    expect(readingLevelOf(80)).toBe('easy');
    expect(readingLevelOf(75)).toBe('fairlyEasy');
    expect(readingLevelOf(65)).toBe('plain');
    expect(readingLevelOf(55)).toBe('fairlyHard');
    expect(readingLevelOf(10)).toBe('hard');
    expect(READING_LEVEL_LABEL.plain).toBe('Plain English');
  });

  it('reads plain how-to text (WCAG 3.1.5, lower secondary) as plain or easier, and dense prose as hard', () => {
    const plain = readabilityOfTexts(
      [
        'Open the box and take out the parts. Put the base on a flat table. Fix the legs to the base with the four screws. Then turn it over and check that it stands firm.',
      ],
      36,
    );
    expect(plain.ease).toBeGreaterThanOrEqual(60);
    const dense = readabilityOfTexts(
      [
        'The interdepartmental communication of the organisation necessitates the comprehensive standardisation of documentation methodologies throughout the implementation.',
      ],
      14,
    );
    expect(dense.level).toBe('hard');
  });
});

describe('readabilityOfTexts', () => {
  it('counts long sentences over the limit, each text ending one', () => {
    const long = Array.from({ length: LONG_SENTENCE_WORDS + 1 }, () => 'the').join(' ');
    const exact = Array.from({ length: LONG_SENTENCE_WORDS }, () => 'the').join(' ');
    const r = readabilityOfTexts([long, exact, 'And the end.'], 64);
    expect(r).toMatchObject({ sentences: 3, longSentences: 1 });
    expect(r.wordsPerSentence).toBe(21.3);
  });

  it('shows no level for writing that is not English, keeping the time and the sentences', () => {
    const r = readabilityOfTexts(['Le chat est sur le tapis. Il dort bien.'], 9);
    expect(r).toMatchObject({ ease: null, level: null, sentences: 2, readingMinutes: 1 });
    expect(readabilityOfTexts(['Die Katze ist in dem Haus.'], 6).level).toBeNull();
  });

  it('says nothing of no writing', () => {
    expect(readabilityOfTexts([], 0)).toEqual({
      readingMinutes: 0,
      sentences: 0,
      wordsPerSentence: 0,
      longSentences: 0,
      ease: null,
      level: null,
    });
  });
});

describe('articleReadability', () => {
  it('reads only the prose: headings, paragraphs and lists, never code, a table or a footnote', () => {
    const blocks: ArticleBlock[] = [
      { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'The plan' }] },
      {
        id: 'p',
        type: 'paragraph',
        runs: [{ text: 'We start' }, { text: 'x', fn: 'a note. With words.' }, { text: ' now.' }],
      },
      { id: 'l', type: 'list', list: 'bullet', runs: [{ text: 'Buy the parts' }] },
      { id: 'c', type: 'code', text: 'const a = 1; const b = 2.' },
      { id: 'd', type: 'divider' },
    ];
    const r = articleReadability({ blocks }, 20);
    // The title, the paragraph (its footnote a space) and the list item: three sentences of 2, 3 and 3 words.
    expect(r.sentences).toBe(3);
    expect(r.wordsPerSentence).toBe(2.7);
    expect(r.readingMinutes).toBe(1);
    expect(r.level).not.toBeNull();
  });
});

describe('labels', () => {
  it('rounds the reading time to the minute, at least one', () => {
    expect(readingMinutesFor(0)).toBe(0);
    expect(readingMinutesFor(5)).toBe(1);
    expect(readingMinutesFor(840)).toBe(4);
    expect(readingTimeLabel({ readingMinutes: 4 })).toBe('4 min read');
    expect(readingTimeLabel({ readingMinutes: 0 })).toBeNull();
  });

  it('writes the numbers behind the level for the hover', () => {
    const r = readabilityOfTexts(['The cat sat on the mat.'], 6);
    expect(readabilityDetail(r)).toBe(
      '6 words a sentence on average · none over 30 words · Flesch Reading Ease 116',
    );
    const long = readabilityOfTexts(
      [Array.from({ length: 31 }, () => 'word').join(' '), 'One.', 'Two.'],
      33,
    );
    expect(readabilityDetail(long)).toBe(
      '11 words a sentence on average · 1 sentence over 30 words',
    );
    expect(readabilityDetail(readabilityOfTexts(['Hi.'], 1))).toBe(
      '1 word a sentence on average · none over 30 words',
    );
    expect(
      readabilityDetail(
        readabilityOfTexts([`${'word '.repeat(31)}`, `${'word '.repeat(31)}`, 'A b.'], 64),
      ),
    ).toContain('2 sentences over 30 words');
    expect(readabilityDetail(readabilityOfTexts([], 0))).toBe('No sentences yet');
  });
});

describe('cost', () => {
  it('reads tens of thousands of spaces, stops or digits in one linear pass', () => {
    // Warmed on a sentence first, so the budget weighs the pass, not the first compile (a pass that looked back
    // would take seconds here).
    for (let k = 0; k < 50; k++) sentencesOf('Dr. Smith, e.g. 3.5 tons... Then "go." Fine!');
    for (const worst of [
      ' '.repeat(50_000),
      '.'.repeat(50_000),
      '9'.repeat(50_000),
      'a. '.repeat(20_000),
      'e.g.'.repeat(12_000),
    ]) {
      let n = 0;
      const spent = cpuMsOf(() => {
        n = sentencesOf(worst).length;
      });
      expect(n).toBeGreaterThanOrEqual(0);
      expect(spent).toBeLessThan(cpuBudgetMs(20));
    }
  });
});
