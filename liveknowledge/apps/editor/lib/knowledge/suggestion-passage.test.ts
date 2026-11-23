import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  arrivingLines,
  changeCounts,
  locatePassage,
  passageWords,
  suggestedEditsLabel,
  wordDiff,
} from './suggestion-passage';

// Finding a suggested edit's passage in the writing (docs/specs/030-knowledgebase/insights.md "On the page").
const PAGE = [
  'Start Here',
  'Self-Hosting liveworkspace',
  'This knowledgebase walks you through running the monorepo yourself.',
  'It was written from main at commit 56ad440631. Paths are relative to the repo root.',
  'What you are hosting',
  'Run my_script.sh first.',
].join('\n');

describe('the words of a passage', () => {
  it('sets the Markdown marks aside', () => {
    expect(passageWords('# Self-Hosting **liveworkspace**')).toEqual([
      'Self-Hosting',
      'liveworkspace',
    ]);
    expect(passageWords('- [x] Read the [guide](https://x.test) `now`\\!')).toEqual([
      'Read',
      'the',
      'guide',
      'now!',
    ]);
    expect(passageWords('> quoted _words_ here')).toEqual(['quoted', 'words', 'here']);
    expect(passageWords('| a | b |\n| --- | --- |\n| c | d |')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps an underscore inside a word', () => {
    expect(passageWords('Run my_script.sh first.')).toEqual(['Run', 'my_script.sh', 'first.']);
  });
});

describe('locating a passage', () => {
  it('finds a heading and paragraph across blocks', () => {
    const before =
      '## Self-Hosting liveworkspace\n\nThis knowledgebase walks you through running the monorepo yourself.';
    const at = locatePassage(PAGE, before);
    expect(at).not.toBeNull();
    expect(PAGE.slice(at!.from, at!.to)).toBe(
      'Self-Hosting liveworkspace\nThis knowledgebase walks you through running the monorepo yourself.',
    );
  });

  it('finds a sentence inside a paragraph', () => {
    const at = locatePassage(PAGE, 'Paths are relative to the repo root.');
    expect(PAGE.slice(at!.from, at!.to)).toBe('Paths are relative to the repo root.');
  });

  it('marks nothing when the passage is gone', () => {
    expect(locatePassage(PAGE, 'Paths are relative to your home folder.')).toBeNull();
  });

  it('marks nothing when the passage sits in two places', () => {
    expect(locatePassage('one two\none two', 'one two')).toBeNull();
  });

  it('marks nothing for an empty passage', () => {
    expect(locatePassage(PAGE, '  \n# ')).toBeNull();
  });

  it('finds a passage with snake_case words', () => {
    expect(locatePassage(PAGE, 'Run `my_script.sh` first.')).not.toBeNull();
  });

  it('stays fast on a long page and a long passage', () => {
    const page = Array.from({ length: 20_000 }, (_, i) => `word${i}`).join(' ');
    const passage = Array.from({ length: 3_000 }, (_, i) => `word${i + 10_000}`).join(' ');
    let found: ReturnType<typeof locatePassage> = null;
    const ms = cpuMsOf(() => {
      found = locatePassage(page, passage);
    });
    expect(found).not.toBeNull();
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});

describe('the words around it', () => {
  it('reads the arriving text line by line', () => {
    expect(arrivingLines('# Self Hosting Documentation\n\nIt is **kept** current.')).toEqual([
      'Self Hosting Documentation',
      'It is kept current.',
    ]);
  });

  it('counts the lines', () => {
    expect(changeCounts({ kind: 'replace', before: 'a\n\nb', after: 'c' })).toBe(
      '2 removed, 1 added',
    );
    expect(changeCounts({ kind: 'append', before: '', after: 'c\nd' })).toBe('2 added');
  });

  it('names the count', () => {
    expect(suggestedEditsLabel(1)).toBe('1 Suggested Edit');
    expect(suggestedEditsLabel(3)).toBe('3 Suggested Edits');
  });
});

describe('the word diff Show in Page draws', () => {
  it('keeps what both share and marks what goes and arrives', () => {
    const steps = wordDiff(['Self-Hosting', 'liveworkspace'], ['Self', 'Hosting', 'Documentation']);
    expect(steps.filter((s) => s.kind === 'same')).toHaveLength(0);
    expect(steps.filter((s) => s.kind === 'gone')).toHaveLength(2);
    expect(steps.filter((s) => s.kind === 'new')).toHaveLength(3);
  });

  it('marks only a sentence added at the end', () => {
    const steps = wordDiff(
      ['Paths', 'are', 'relative.'],
      ['Paths', 'are', 'relative.', 'It', 'is', 'kept.'],
    );
    expect(steps.map((s) => s.kind)).toEqual(['same', 'same', 'same', 'new', 'new', 'new']);
  });

  it('gives up on a word-by-word diff past its bound, all at once', () => {
    const many = Array.from({ length: 600 }, (_, i) => `w${i}`);
    let steps: ReturnType<typeof wordDiff> = [];
    const ms = cpuMsOf(() => {
      steps = wordDiff(many, many);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(100));
    expect(steps.filter((s) => s.kind === 'gone')).toHaveLength(600);
    expect(steps.filter((s) => s.kind === 'new')).toHaveLength(600);
  });
});
