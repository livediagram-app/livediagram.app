import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livepages/vitest-config/cpu-time';
import { HERO_SHEETS, heroGreeting, heroPills, heroSheets } from './hero-model';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): the greeting by hour, the pills' words and
// when they show, and the sheets' documents.

describe('heroGreeting', () => {
  it('says good morning from 5 to 11, good afternoon from 12 to 17, good evening otherwise', () => {
    expect(heroGreeting(4)).toBe('Good evening.');
    expect(heroGreeting(5)).toBe('Good morning.');
    expect(heroGreeting(11)).toBe('Good morning.');
    expect(heroGreeting(12)).toBe('Good afternoon.');
    expect(heroGreeting(17)).toBe('Good afternoon.');
    expect(heroGreeting(18)).toBe('Good evening.');
    expect(heroGreeting(0)).toBe('Good evening.');
  });
});

describe('heroPills', () => {
  it('counts the documents and says how the Inbox stands', () => {
    expect(heroPills({ documents: 1, inbox: 0 })).toEqual([
      { id: 'documents', label: '1 document', tone: 'emerald' },
      { id: 'inbox', label: 'Inbox is clear', tone: 'sky' },
    ]);
    expect(heroPills({ documents: 9, inbox: 3 }).map((p) => p.label)).toEqual([
      '9 documents',
      '3 open in your Inbox',
    ]);
    expect(heroPills({ documents: 0, inbox: 1 })[0]!.label).toBe('0 documents');
  });

  it('draws a pill only once its count is known', () => {
    expect(heroPills({ documents: undefined, inbox: undefined })).toEqual([]);
    expect(heroPills({ documents: undefined, inbox: 0 }).map((p) => p.id)).toEqual(['inbox']);
    expect(heroPills({ documents: 2, inbox: undefined }).map((p) => p.id)).toEqual(['documents']);
  });
});

describe('heroSheets', () => {
  const doc = (id: string, savedAt: number) => ({ id, savedAt });

  it('keeps the newest few, newest first', () => {
    const docs = [doc('a', 1), doc('b', 5), doc('c', 3), doc('d', 9), doc('e', 2)];
    expect(heroSheets(docs).map((d) => d.id)).toEqual(['d', 'b', 'c']);
    expect(HERO_SHEETS).toBe(3);
  });

  it('returns what there is when there are fewer, and nothing for none', () => {
    expect(heroSheets([doc('a', 1), doc('b', 2)]).map((d) => d.id)).toEqual(['b', 'a']);
    expect(heroSheets([])).toEqual([]);
  });

  it('keeps the list order for equal saves', () => {
    expect(
      heroSheets([doc('a', 1), doc('b', 1), doc('c', 1), doc('d', 1)]).map((d) => d.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('scans a long list in linear time', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => doc(String(i), (i * 7919) % 200_000));
    let top: { savedAt: number }[] = [];
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => (top = heroSheets(many)))));
    // Measured 2 ms on an M-series Mac (2026-10-17); sorting a copy took 31 ms.
    expect(best).toBeLessThan(cpuBudgetMs(30));
    expect(top.map((d) => d.savedAt)).toEqual([199_999, 199_998, 199_997]);
  });
});
