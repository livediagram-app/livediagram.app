import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement } from '@livepages/document';
import { remintElements, remintTabElements } from './useTabImport';

const remintElementIds = (elements: Element[]) => remintElements(elements).elements;

// Duplicate Tab and JSON import re-mint ids.
// References between elements must follow the new ids, or the copy points
// back at the source tab.

const shape = (id: string, extra: Partial<ShapeElement> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

describe('remintElementIds', () => {
  it('re-parents mind-map nodes and re-pairs portals onto the new ids', () => {
    const out = remintElementIds([
      shape('root'),
      shape('child', { mindParentId: 'root' }),
      shape('p1', { portalTarget: 'p2' }),
      shape('p2', { portalTarget: 'p1' }),
    ]) as ShapeElement[];
    const [root, child, p1, p2] = out;
    expect(root!.id).not.toBe('root');
    expect(child!.mindParentId).toBe(root!.id);
    expect(p1!.portalTarget).toBe(p2!.id);
    expect(p2!.portalTarget).toBe(p1!.id);
  });

  it('keeps element order, which is stacking order', () => {
    const out = remintElementIds([
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 1, y: 1 },
      },
      shape('s'),
    ]);
    expect(out.map((e) => e.type)).toEqual(['arrow', 'shape']);
  });

  it('links a chart to the copy of its Sheet', () => {
    const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
    const [sheet, chart] = remintElementIds([
      shape('s', { shape: 'plan-sheet', planSheet: { sheetId: 'sheet0001' } }),
      shape('c', { shape: 'bar-chart', chartSource: { sheetId: 'sheet0001', range } }),
    ]) as ShapeElement[];
    expect(sheet!.planSheet!.sheetId).not.toBe('sheet0001');
    expect(chart!.chartSource).toEqual({ sheetId: sheet!.planSheet!.sheetId, range });
  });
});

// docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard": a duplicated or imported Dashboard follows its
// re-minted elements and Sheets, and its rows and slots take ids of their own.
describe('remintTabElements on a Dashboard', () => {
  const SHEET = 'a1b2c3d4e5f60718';
  const sheet = shape('s', { shape: 'plan-sheet', planSheet: { sheetId: SHEET } } as never);
  const tab = {
    elements: [sheet],
    dashboard: {
      rows: [
        {
          id: 'r',
          height: 300,
          slots: [
            { id: 'a', span: 6, content: { type: 'element' as const, elementId: 's' } },
            {
              id: 'b',
              span: 6,
              content: {
                type: 'sheet-metric' as const,
                metric: 'figure' as const,
                sheetId: SHEET,
                cell: { r: 'abcd', c: 'efgh' },
              },
            },
          ],
        },
      ],
    },
  };

  it('points a figure from the tab’s Sheet at the Sheet’s copy', () => {
    const out = remintTabElements(tab);
    const copy = (out.elements[0] as ShapeElement).planSheet!.sheetId;
    expect(copy).not.toBe(SHEET);
    const [element, figure] = out.dashboard.rows[0]!.slots;
    expect(element!.content).toEqual({ type: 'element', elementId: out.elements[0]!.id });
    expect(figure!.content).toMatchObject({ type: 'sheet-metric', sheetId: copy });
  });

  it('gives every row and slot a new id', () => {
    const out = remintTabElements(tab);
    expect(out.dashboard.rows[0]!.id).not.toBe('r');
    expect(out.dashboard.rows[0]!.slots.map((s) => s.id)).not.toContain('a');
    expect(out.dashboard.rows[0]!.slots.map((s) => s.id)).not.toContain('b');
  });
});
