// This Browser's lens (this-browser-lens.ts): what the list keeps matches as it would at the index; what it does not
// keep matches nothing; and a whole list narrows well inside a frame.
import { describe, expect, it } from 'vitest';
import { parseLens, type LensContext } from '../lens';
import type { ThisBrowserItem } from '../this-browser';
import { narrowThisBrowser, thisBrowserSubjects } from './this-browser-lens';

const context: LensContext = {
  view: 'scoped',
  teams: [],
  templates: [{ value: 'retrospective', label: 'Retrospective' }],
  modes: [{ value: 'draw', label: 'Draw' }],
};
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 26, 12);

const local = (n: number, over: Partial<ThisBrowserItem> = {}): ThisBrowserItem => ({
  id: `local-${n}`,
  title: `Local ${n}`,
  createdAt: NOW - 100 * DAY,
  updatedAt: NOW - n * DAY,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  ...over,
});

const narrow = (items: ThisBrowserItem[], q: string) =>
  narrowThisBrowser(items, parseLens(q, context).lens, 'livediagram', NOW).map((i) => i.id);

describe('This Browser’s lens', () => {
  const items = [local(0, { title: 'Road map' }), local(3), local(40, { title: 'Old road' })];

  it('matches the name, the last change, the app and the reader’s own', () => {
    expect(narrowThisBrowser(items, parseLens('', context).lens, 'livediagram', NOW)).toBe(items);
    expect(narrow(items, 'road')).toEqual(['local-0', 'local-40']);
    expect(narrow(items, 'edited:7d')).toEqual(['local-0', 'local-3']);
    expect(narrow(items, 'road edited:7d')).toEqual(['local-0']);
    expect(narrow(items, 'opens-in:canvas people:me')).toHaveLength(3);
    expect(narrow(items, 'opens-in:plan')).toEqual([]);
    expect(narrow(items, 'people:others')).toEqual([]);
  });

  it('matches nothing on what the list does not keep', () => {
    expect(narrow(items, 'made-by:ai')).toEqual([]);
    expect(narrow(items, 'template:retrospective')).toEqual([]);
    expect(narrow(items, 'mode:draw')).toEqual([]);
  });

  it('hands the field every item as the lens reads it', () => {
    expect(thisBrowserSubjects(items, 'livediagram')[0]).toMatchObject({
      name: 'Road map',
      opensIn: 'canvas',
      space: 'mine',
      people: 'me',
      mode: null,
    });
  });

  it('narrows a long list well inside a frame', () => {
    const many = Array.from({ length: 5_000 }, (_, i) =>
      local(i % 60, { id: `l${i}`, title: `Item ${i} ${i % 7 ? 'plan' : 'road map'}` }),
    );
    const lens = parseLens('road map edited:30d opens-in:canvas', context).lens;
    const started = performance.now();
    const left = narrowThisBrowser(many, lens, 'livediagram', NOW);
    const ms = performance.now() - started;
    console.info(`This Browser lens, 5,000 items: ${ms.toFixed(1)} ms`);
    expect(left.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});
