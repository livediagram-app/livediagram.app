import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Page } from './index';
import { versionChanges, versionChangesLine } from './version-changes';

// What changed since a version (docs/specs/006-document/version-history.md "Opening a version").

const box = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});
const slide = (id: string): Page => ({ id, orientation: 'landscape', kind: 'slide' });

describe('versionChanges', () => {
  it('sorts elements into removed, changed and added since, by id', () => {
    const same = box('same');
    const changes = versionChanges(
      { elements: [same, box('gone'), box('moved', { x: 1 })] },
      { elements: [same, box('moved', { x: 2 }), box('new')] },
    );
    expect(changes).toMatchObject({ removed: ['gone'], changed: ['moved'], added: ['new'] });
  });

  it('never counts the conversation as a change', () => {
    const changes = versionChanges(
      { elements: [box('a')] },
      { elements: [box('a', { commentThread: { id: 't', comments: [] }, action: { kind: 'x' } })] },
    );
    expect(changes.changed).toEqual([]);
  });

  it('counts pages either side lacks and a change in the writing', () => {
    const changes = versionChanges(
      { elements: [], pages: [slide('s1'), slide('s2')], articles: { a: { blocks: [] } } },
      { elements: [], pages: [slide('s1'), slide('s3'), slide('s4')], articles: {} },
    );
    expect(changes).toMatchObject({ pagesAdded: 2, pagesRemoved: 1, writingChanged: true });
  });

  it('reads the same articles as unchanged', () => {
    const articles = { a: { blocks: [] } };
    expect(
      versionChanges({ elements: [], articles }, { elements: [], articles }).writingChanged,
    ).toBe(false);
    expect(
      versionChanges({ elements: [], articles }, { elements: [], articles: { ...articles } })
        .writingChanged,
    ).toBe(false);
  });

  it('compares two 2,000-element tabs within budget', () => {
    const before = Array.from({ length: 2000 }, (_, i) => box(`e${i}`, { label: `Box ${i}` }));
    const after = before.map((e, i) => (i % 10 === 0 ? { ...e, x: 5 } : { ...e }));
    let changed = 0;
    const took = cpuMsOf(() => {
      changed = versionChanges({ elements: before }, { elements: after }).changed.length;
    });
    expect(changed).toBe(200);
    expect(took).toBeLessThan(cpuBudgetMs(100));
  });
});

describe('versionChangesLine', () => {
  it('says what changed in one line, or nothing', () => {
    expect(
      versionChangesLine({
        removed: ['a', 'b'],
        changed: ['c', 'd', 'e'],
        added: ['f'],
        pagesAdded: 1,
        pagesRemoved: 2,
        writingChanged: true,
      }),
    ).toBe('3 changed, 2 removed, 1 added · 1 page added · 2 pages removed · the writing changed');
    expect(
      versionChangesLine({
        removed: [],
        changed: [],
        added: [],
        pagesAdded: 0,
        pagesRemoved: 0,
        writingChanged: false,
      }),
    ).toBeNull();
  });
});
