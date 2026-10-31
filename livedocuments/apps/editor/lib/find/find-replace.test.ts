import { describe, expect, it } from 'vitest';
import { runsPlainText, type Element, type TextRun } from '@livedocuments/document';
import { replaceInRuns, replaceInString, replaceInTab } from './find-replace';
import { findMatches } from './find-matches';
import { findTargets } from './find-targets';
import { DEFAULT_FIND_OPTIONS } from './find-text';
import { fixtureTab, rowsOf } from '@/test/find-fixture';

// docs/specs/007-editor/find-and-replace.md "Replace".
describe('replaceInRuns', () => {
  const runs = [{ text: 'Our ' }, { text: 'pl', b: true }, { text: 'an is a plan.' }];

  it('gives the new words the formatting of the run the match starts in', () => {
    // "plan" starts in the bold run and ends in the plain one.
    expect(replaceInRuns(runs, [[4, 8]], 'scheme')).toEqual([
      { text: 'Our ' },
      { text: 'scheme', b: true },
      { text: ' is a plan.' },
    ]);
  });

  it('swaps several ranges, one at a run boundary, and deletes with empty words', () => {
    expect(
      replaceInRuns(
        [{ text: 'ab' }, { text: 'cd', i: true }],
        [
          [0, 1],
          [2, 3],
        ],
        'X',
      ),
    ).toEqual([{ text: 'Xb' }, { text: 'Xd', i: true }]);
    expect(replaceInRuns([{ text: 'abc' }], [[0, 3]], '')).toEqual([{ text: '' }]);
  });

  it('swaps a range running across three runs', () => {
    expect(
      replaceInRuns([{ text: 'ab' }, { text: 'cd', b: true }, { text: 'ef' }], [[1, 5]], '-'),
    ).toEqual([{ text: 'a-' }, { text: '', b: true }, { text: 'f' }]);
  });

  it('swaps ranges in a plain string', () => {
    expect(
      replaceInString(
        'plan a plan',
        [
          [0, 4],
          [7, 11],
        ],
        'map',
      ),
    ).toBe('map a map');
  });
});

describe('replaceInTab', () => {
  const tab = fixtureTab();
  const targets = findTargets(tab, rowsOf(tab), { scope: 'any' });
  const { matches } = findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS);

  it('replaces every match in one new tab, the writing and the elements alike', () => {
    const out = replaceInTab(tab, targets, matches, 'map');
    expect(out.count).toBe(matches.length);
    expect(out.held).toBe(0);
    const after = findTargets(out.tab, rowsOf(out.tab), { scope: 'any' });
    expect(findMatches(after, 'plan', DEFAULT_FIND_OPTIONS).matches).toEqual([]);
    const blocks = out.tab.articles!.f1!.blocks;
    expect(blocks[1]).toEqual({
      id: 'body',
      type: 'paragraph',
      runs: [{ text: 'Our ' }, { text: 'map', b: true }, { text: ' is a map.' }],
    });
    expect(blocks[3]).toEqual({ id: 'code', type: 'code', text: 'map()' });
    // A divider is untouched.
    expect(blocks[4]).toBe(tab.articles!.f1!.blocks[4]);
    const byId = new Map(
      out.tab.elements.map((e) => [e.id, e as Element & Record<string, unknown>]),
    );
    expect(byId.get('table')!.cells).toEqual([
      ['map', 'Owner'],
      ['map B', 'Sam'],
    ]);
    expect(byId.get('checklist')!.checklistItems).toEqual([{ text: 'Write the map', done: false }]);
    expect(byId.get('box')!.pageTitle).toBe('A map title');
  });

  it('keeps a rich label its runs, with the label their text', () => {
    const out = replaceInTab(tab, targets, matches, 'map');
    const sticky = out.tab.elements.find((e) => e.id === 'sticky') as Element & {
      richText: TextRun[];
      label: string;
    };
    expect(sticky.richText).toEqual([{ text: 'Sticky ' }, { text: 'map', bold: true }]);
    expect(sticky.label).toBe(runsPlainText(sticky.richText));
  });

  it('writes a label alone when its runs no longer say it', () => {
    const odd = fixtureTab({
      elements: tab.elements.map((e) =>
        e.id === 'sticky' ? ({ ...e, richText: [{ text: 'other' }] } as Element) : e,
      ),
    });
    const t = findTargets(odd, rowsOf(odd), { scope: 'any' });
    const out = replaceInTab(
      odd,
      t,
      findMatches(t, 'sticky', DEFAULT_FIND_OPTIONS).matches,
      'Note',
    );
    const sticky = out.tab.elements.find((e) => e.id === 'sticky') as Element & { label: string };
    expect(sticky.label).toBe('Note plan');
  });

  it('passes over held matches and counts them', () => {
    const t = findTargets(tab, rowsOf(tab), { scope: 'text' });
    const m = findMatches(t, 'plan', DEFAULT_FIND_OPTIONS).matches;
    const out = replaceInTab(tab, t, m, 'map');
    expect(out.held).toBe(1);
    expect(out.count).toBe(m.length - 1);
    const checklist = out.tab.elements.find((e) => e.id === 'checklist') as Element & {
      checklistItems: { text: string }[];
    };
    expect(checklist.checklistItems[0]!.text).toBe('Write the plan');
  });

  it('answers the same tab when nothing changes, and refits what does', () => {
    expect(replaceInTab(tab, targets, [], 'x').tab).toBe(tab);
    const refitted: string[] = [];
    replaceInTab(tab, targets, matches, 'map', (el) => {
      refitted.push(el.id);
      return el;
    });
    expect(refitted.sort()).toEqual(['box', 'checklist', 'sticky', 'table']);
  });
});
