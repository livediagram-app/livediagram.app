// Make These a Plan's trigger (docs/specs/013-workspace/suggestions.md): stickies holding an open assigned action, or
// in an Actions lane, counted cheaply.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { actionStickies, isActionHeading } from './action-stickies';

const sticky = (id: string, x: number, y: number, label = 'Do a thing', extra = {}) => ({
  id,
  type: 'sticky',
  label,
  x,
  y,
  width: 100,
  height: 100,
  ...extra,
});

// A retro's Action items column: its panel, its heading text, stickies inside and outside.
const lane = [
  { id: 'panel', type: 'shape', x: 1000, y: 0, width: 400, height: 1000 },
  { id: 'head', type: 'text', label: 'Action items', x: 1020, y: 20, width: 200, height: 40 },
];

describe('isActionHeading', () => {
  it('reads the headings an Actions lane goes by, on the first line, any case', () => {
    for (const label of [
      'Actions',
      'ACTION ITEMS',
      'Action items:',
      'Next steps',
      'To do',
      'TODO',
      '✅ Actions\nOwner and day',
    ])
      expect(isActionHeading(label)).toBe(true);
    for (const label of [
      '',
      'Actions we took last sprint',
      'What went well',
      'Transactions',
      'Next',
    ])
      expect(isActionHeading(label)).toBe(false);
  });
});

describe('actionStickies', () => {
  it('finds stickies in the lane and stickies with an open action, in reading order', () => {
    const found = actionStickies([
      ...lane,
      sticky('in2', 1100, 400),
      sticky('in1', 1100, 200),
      sticky('outside', 100, 100),
      sticky('assigned', 50, 900, 'Book the room', { action: { status: 'open' } }),
      sticky('wontdo', 60, 950, 'Skip', { action: { status: 'wont-do' } }),
      sticky('blank', 1100, 600, '   '),
    ]);
    expect(found.map((s) => s.id)).toEqual(['in1', 'in2', 'assigned']);
  });

  it('finds no lane without a container around its heading, and none in an empty tab', () => {
    expect(actionStickies([lane[1]!, sticky('a', 1020, 20)])).toEqual([]);
    expect(actionStickies([])).toEqual([]);
  });

  it('takes the smallest container around the heading as the lane', () => {
    const found = actionStickies([
      { id: 'board', type: 'shape', x: 0, y: 0, width: 5000, height: 5000 },
      ...lane,
      sticky('in', 1100, 200),
      sticky('elsewhere', 3000, 3000),
    ]);
    expect(found.map((s) => s.id)).toEqual(['in']);
  });

  it('checks a 2,000 element tab well within a millisecond budget (measured)', () => {
    const elements = [...lane];
    for (let i = 0; i < 2_000; i++)
      elements.push(sticky(`s${i}`, (i % 50) * 120, Math.floor(i / 50) * 120));
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i++) actionStickies(elements);
    });
    // Twenty checks; one runs at most every 5 s while the page is idle.
    expect(ms / 20).toBeLessThan(cpuBudgetMs(5));
  });
});
