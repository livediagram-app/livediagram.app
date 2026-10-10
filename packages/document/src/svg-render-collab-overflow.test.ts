import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape } from './factories';
import { fitLine, wrapLines } from './svg-render-face-kit';
import type { QaNote, ShapeElement, Tab } from './index';

// Collaborate cards export without text running off the card
// (docs/specs/020-import-export/export-fidelity.md): a long title, a long
// driver, a long roll-call name; and a board whose notes are all discussed
// shows its Discussed drawer, not "No notes yet".

const svgOf = (el: ShapeElement) =>
  renderElementsToSvg({ id: 't', name: 'Tab', elements: [el] } as unknown as Tab);
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
    const long = 'A very long done check title that would run under the count and off the card';
    const el = {
      ...(createShape('estimate', 0, 0) as ShapeElement),
      label: long,
      estimateScale: 'fibonacci',
      responses: [{ participantId: 'a', value: '3', at: 1 }],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).not.toContain(long);
    const title = all.find((t) => t.startsWith('A very long'))!;
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('Q&A board with every note discussed', () => {
  it('shows the Discussed drawer, not the empty state', () => {
    const note = (i: number): QaNote => ({
      id: `n${i}`,
      text: `Note ${i}`,
      voters: [],
      at: 1,
      state: 'done',
      doneAt: i,
    });
    const el = {
      ...(createShape('qa-board', 0, 0) as ShapeElement),
      qaNotes: [note(1), note(2)],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).not.toContain('No notes yet');
    expect(all).toContain('DISCUSSED · 2');
  });
});

describe('decision drivers', () => {
  it('wraps a long driver and counts the ones that do not fit', () => {
    const drivers = [
      'A driver long enough that it has to wrap onto a second line of the card at the very least',
      ...Array.from({ length: 19 }, (_, i) => `Driver ${i + 2}`),
    ];
    const el = {
      ...(createShape('decision', 0, 0) as ShapeElement),
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
      ...(createShape('decision', 0, 0) as ShapeElement),
      decisionDrivers: ['Cheap', 'Fast'],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).toContain('Cheap');
    expect(all).toContain('Fast');
    expect(all.some((t) => t.endsWith(' more'))).toBe(false);
  });
});

describe('roll call chips', () => {
  it('cuts a long name to its chip', () => {
    const name = 'Bartholomew Maximilian Featherstonehaugh-Cholmondeley the Third of Somewhere';
    const el = {
      ...(createShape('roll-call', 0, 0) as ShapeElement),
      rollCall: [{ name, color: '#2563eb', at: 1_700_000_000_000 }],
    } as ShapeElement;
    const all = texts(svgOf(el));
    expect(all).not.toContain(name);
    expect(all.some((t) => t.startsWith('Bartholomew') && t.endsWith('…'))).toBe(true);
  });
});
