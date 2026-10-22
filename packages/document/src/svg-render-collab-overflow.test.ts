import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape } from './factories';
import { fitLine, wrapLines } from './svg-render-face-kit';
import type { ShapeElement } from './index';

// Collaborate cards export without text running off the card
// (docs/specs/020-import-export/export-fidelity.md): a long title, a long driver.

const svgOf = (el: ShapeElement) => renderElementsToSvg({ id: 't', name: 'Tab', elements: [el] });
// Each <text>'s content, by splitting rather than a backtracking regex (linear in the SVG's length).
const texts = (svg: string) =>
  svg
    .split('<text')
    .slice(1)
    .map((part) => part.slice(part.indexOf('>') + 1, part.indexOf('</text>')));

describe('fitLine', () => {
  it('keeps a short line and cuts a long one with an ellipsis', () => {
    expect(fitLine('Retro', 200, 10)).toBe('Retro');
    const cut = fitLine('x'.repeat(100), 52, 10);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(10);
  });

  it('cuts a single word longer than a wrapped line', () => {
    const [line] = wrapLines('y'.repeat(200), 104, 10, 2);
    expect(line!.length).toBeLessThanOrEqual(20);
    expect(line!.endsWith('…')).toBe(true);
  });
});

describe('collab card title', () => {
  it('takes one line, cut short of the aside', () => {
    const long =
      'A very long temperature check title that would run under the count and off the card';
    const el = {
      ...createShape('temperature', 0, 0),
      label: long,
      responses: [{ participantId: 'a', value: '3', at: 1 }],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).not.toContain(long);
    const title = all.find((t) => t.startsWith('A very long'))!;
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('decision drivers', () => {
  it('wraps a long driver and counts the ones that do not fit', () => {
    const drivers = [
      'A driver long enough that it has to wrap onto a second line of the card at the very least',
      ...Array.from({ length: 19 }, (_, i) => `Driver ${i + 2}`),
    ];
    const el = {
      ...createShape('decision', 0, 0),
      label: 'Use Postgres',
      decisionDrivers: drivers,
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).not.toContain(drivers[0]);
    expect(all.some((t) => t.startsWith('A driver long enough'))).toBe(true);
    const more = all.find((t) => /^\+\d+ more$/.test(t));
    expect(more).toBeDefined();
    const shown = all.filter((t) => /^Driver \d+$/.test(t)).length + 1;
    expect(Number(more!.slice(1, -5))).toBe(drivers.length - shown);
  });

  it('draws every driver, without a count, when they fit', () => {
    const el = {
      ...createShape('decision', 0, 0),
      decisionDrivers: ['Cheap', 'Fast'],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).toContain('Cheap');
    expect(all).toContain('Fast');
    expect(all.some((t) => t.endsWith(' more'))).toBe(false);
  });
});
