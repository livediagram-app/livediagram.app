import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { commitTag, commitTagInput, tagPreview } from './tag-draft';

// The publish dialog's tag field (docs/specs/025-community/community.md "Tags").

describe('commitTag', () => {
  it('normalises what is typed before it becomes a chip', () => {
    expect(commitTag([], '  Cloud_Native AWS! ')).toEqual({
      tags: ['cloud-native-aws'],
      rejected: null,
    });
  });

  it('ignores a blank draft', () => {
    expect(commitTag(['a1'], '   ')).toEqual({ tags: ['a1'], rejected: null });
  });

  it('rejects a draft that normalises to too little', () => {
    expect(commitTag([], '!!x')).toEqual({ tags: [], rejected: 'invalid' });
  });

  it('keeps accented and non-Latin letters', () => {
    expect(commitTag(['aws'], 'Café Crème')).toEqual({
      tags: ['aws', 'café-crème'],
      rejected: null,
    });
    expect(commitTag([], '日本語')).toEqual({ tags: ['日本語'], rejected: null });
    // A decomposed accent is the same tag as a composed one.
    expect(commitTag(['café'], 'CAFE\u0301')).toEqual({ tags: ['café'], rejected: 'duplicate' });
    expect(commitTag([], '日')).toEqual({ tags: [], rejected: 'invalid' });
  });

  it('rejects a duplicate after normalising', () => {
    expect(commitTag(['kanban'], 'KANBAN')).toEqual({ tags: ['kanban'], rejected: 'duplicate' });
  });

  it('holds at five', () => {
    const five = ['aa', 'bb', 'cc', 'dd', 'ee'];
    expect(commitTag(five, 'ff')).toEqual({ tags: five, rejected: 'full' });
  });
});

describe('commitTagInput', () => {
  it('commits each piece before the last comma and keeps the rest as the draft', () => {
    expect(commitTagInput([], 'aws, Event Storming,ddd')).toEqual({
      tags: ['aws', 'event-storming'],
      draft: 'ddd',
      rejected: null,
    });
  });

  it('reports the first rejection and keeps the good pieces', () => {
    expect(commitTagInput(['aws'], 'AWS,x,retro,')).toEqual({
      tags: ['aws', 'retro'],
      draft: '',
      rejected: 'duplicate',
    });
  });
});

describe('tagPreview', () => {
  it('shows what a draft will be stored as, or null', () => {
    expect(tagPreview('My Tag')).toBe('my-tag');
    expect(tagPreview('x')).toBeNull();
    expect(tagPreview('  ')).toBeNull();
  });

  it('previews accented and non-Latin tags as they will be stored', () => {
    expect(tagPreview('Ünïcödé Tags')).toBe('ünïcödé-tags');
    expect(tagPreview('हिन्दी विकी')).toBe('हिन्दी-विकी');
    expect(tagPreview('Москва!')).toBe('москва');
  });
});

describe('long pasted input', () => {
  // One pass over the code points, no backtracking: a huge paste costs no more than reading it.
  const N = 50_000;
  it.each([
    ['spaces before a tag', `${' '.repeat(N)}ab`, 'ab'],
    ['hyphens and spaces', '- '.repeat(N), null],
    ['punctuation', '!'.repeat(N), null],
    ['letters', 'é'.repeat(N), null],
    ['a letter and its marks', `a${'\u0301'.repeat(N)}`, null],
    ['marks alone', '\u0301'.repeat(N), null],
    ['emoji', '🚀'.repeat(N), null],
  ])('%s stay within budget', (_name, input, want) => {
    let result: string | null = 'unset';
    const cpu = cpuMsOf(() => {
      result = tagPreview(input);
    });
    expect(result).toBe(want);
    expect(cpu).toBeLessThan(cpuBudgetMs(60));
  });

  it('a paste of many commas stays within budget', () => {
    let result: ReturnType<typeof commitTagInput> | null = null;
    const cpu = cpuMsOf(() => {
      result = commitTagInput([], `${'é,'.repeat(N)}café`);
    });
    expect(result).toEqual({ tags: [], draft: 'café', rejected: 'invalid' });
    expect(cpu).toBeLessThan(cpuBudgetMs(60));
  });
});
