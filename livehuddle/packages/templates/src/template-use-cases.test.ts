// The board grids (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the PESTLE scan and the KWL chart draw
// what their data says.
import { describe, expect, it } from 'vitest';
import type { Element, ShapeElement, StickyElement } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { BOARD_GRIDS, type BoardGridKind } from './template-board-grid-data';
import { templateEditorMode } from './template-modes';

const shapes = (els: Element[], kind?: string) =>
  els.filter(
    (e): e is ShapeElement => e.type === 'shape' && (kind === undefined || e.shape === kind),
  );
const stickies = (els: Element[]) => els.filter((e): e is StickyElement => e.type === 'sticky');
const labels = (els: Element[]) => els.map((e) => ('label' in e ? e.label : undefined));
const inside = (inner: ShapeElement, outer: ShapeElement) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe.each(Object.keys(BOARD_GRIDS) as BoardGridKind[])('the %s board grid', (kind) => {
  const grid = BOARD_GRIDS[kind];
  const els = buildTemplate(kind, 0, 0);

  it('draws every panel with its name and every note inside it', () => {
    const panels = shapes(els, 'square').filter((s) => s.width === grid.panelW);
    expect(panels).toHaveLength(grid.panels.length);
    const notes = stickies(els);
    grid.panels.forEach((panel, i) => {
      expect(labels(els)).toContain(panel.label);
      const box = panels[i]!;
      for (const text of panel.notes) {
        const note = notes.find((n) => n.label === text)!;
        expect(note, text).toBeDefined();
        expect(inside(note as unknown as ShapeElement, box), text).toBe(true);
      }
    });
  });

  it('runs its session and closes on a checklist as its data says', () => {
    const buttons = shapes(els, 'session-button');
    expect(buttons).toHaveLength(grid.rail ? 2 : 0);
    // A session tool needs the Session strip, which every board has: each opens in Workshop.
    expect(templateEditorMode(kind)).toBe('workshop');
    const items = shapes(els, 'checklist').flatMap((c) => c.checklistItems!.map((i) => i.text));
    expect(items).toEqual([...(grid.closing?.items ?? [])]);
  });
});
