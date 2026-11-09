// Which page the Quick Style bar sits on (docs/specs/008-canvas/quick-style-panel.md "Where it sits").
import { describe, expect, it } from 'vitest';
import type { Element, LaidOutPage } from '@livedesign/design';
import { quickStyleBarPage, quickStyleStyledIds } from './quick-style-bar';
import { toolHighlighterStyle } from './quick-style-highlighter';
import type { QuickStyleView } from './quick-style';

const page = (id: string, x: number): LaidOutPage => ({
  id,
  orientation: 'landscape',
  index: 0,
  rect: { x, y: 0, width: 100, height: 60 },
});
const box = (id: string, x: number, y = 20): Element =>
  ({ id, type: 'shape', shape: 'rect', x, y, width: 10, height: 10 }) as unknown as Element;

const pages = [page('a', 0), page('b', 200), page('c', 400)];

describe('quickStyleBarPage', () => {
  it('is the page under the centre of most of the styled elements', () => {
    const els = [box('1', 10), box('2', 210), box('3', 250)];
    expect(quickStyleBarPage(['1', '2', '3'], els, pages, 'c')).toBe('b');
    expect(quickStyleBarPage(['1'], els, pages, 'c')).toBe('a');
  });

  it('breaks a tie by the page first in the row', () => {
    const els = [box('1', 410), box('2', 210)];
    expect(quickStyleBarPage(['1', '2'], els, pages, null)).toBe('b');
  });

  it('takes the nearest page for a selection off every page', () => {
    expect(quickStyleBarPage(['1'], [box('1', 370)], pages, null)).toBe('c');
    expect(quickStyleBarPage(['1'], [box('1', 230, 200)], pages, null)).toBe('b');
  });

  it('puts a tool in hand on the page you are on, else the first', () => {
    expect(quickStyleBarPage([], [box('1', 10)], pages, 'c')).toBe('c');
    expect(quickStyleBarPage([], [], pages, null)).toBe('a');
    expect(quickStyleBarPage([], [], pages, 'gone')).toBe('a');
  });

  it('is none with no pages, or styled elements no longer there', () => {
    expect(quickStyleBarPage(['1'], [box('1', 10)], [], 'a')).toBeNull();
    expect(quickStyleBarPage([], [box('1', 10)], null, 'a')).toBeNull();
    expect(quickStyleBarPage(['gone'], [box('1', 10)], pages, 'a')).toBeNull();
  });
});

describe('quickStyleStyledIds', () => {
  it('is the targets, then the marker strokes and highlights, and nothing for a tool in hand', () => {
    const view: QuickStyleView = {
      targetIds: ['s'],
      sections: {},
      pen: {
        subject: { kind: 'strokes', ids: ['m1', 'm2'], name: '2 marker strokes' },
        colour: { value: null, options: [] },
        width: { value: null },
      },
      highlighter: {
        subject: { kind: 'strokes', ids: ['h'], name: 'Highlight' },
        colour: { value: null, options: [] },
        width: { value: null },
      },
    };
    expect(quickStyleStyledIds(view)).toEqual(['s', 'm1', 'm2', 'h']);
    expect(
      quickStyleStyledIds({
        targetIds: [],
        sections: {},
        highlighter: toolHighlighterStyle('#fde047', 14),
      }),
    ).toEqual([]);
  });
});
