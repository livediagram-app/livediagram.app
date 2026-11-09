// Which page the Quick Style bar sits on (docs/specs/008-canvas/quick-style-panel.md "Where it sits").
import { describe, expect, it } from 'vitest';
import type { Element, LaidOutPage } from '@livedocuments/document';
import { quickStyleBarPage } from './quick-style-bar';

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
    expect(quickStyleBarPage(['1', '2', '3'], els, pages)).toBe('b');
    expect(quickStyleBarPage(['1'], els, pages)).toBe('a');
  });

  it('breaks a tie by the page first in the row', () => {
    const els = [box('1', 410), box('2', 210)];
    expect(quickStyleBarPage(['1', '2'], els, pages)).toBe('b');
  });

  it('takes the nearest page for a selection off every page', () => {
    expect(quickStyleBarPage(['1'], [box('1', 370)], pages)).toBe('c');
    expect(quickStyleBarPage(['1'], [box('1', 230, 200)], pages)).toBe('b');
  });

  it('is none with no pages, no targets, or targets no longer there', () => {
    expect(quickStyleBarPage(['1'], [box('1', 10)], [])).toBeNull();
    expect(quickStyleBarPage(['1'], [box('1', 10)], null)).toBeNull();
    expect(quickStyleBarPage([], [box('1', 10)], pages)).toBeNull();
    expect(quickStyleBarPage(['gone'], [box('1', 10)], pages)).toBeNull();
  });
});
