// The use-case batch (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the four board grids draw what their
// data says, the concept map reads as sentences, and the network diagram keeps every device in its VLAN.
import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement, StickyElement } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { BOARD_GRIDS, type BoardGridKind } from './template-board-grid-data';
import { templateEditorMode } from './template-modes';

const shapes = (els: Element[], kind?: string) =>
  els.filter(
    (e): e is ShapeElement => e.type === 'shape' && (kind === undefined || e.shape === kind),
  );
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');
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

  it('names its axes, runs its session and closes on a checklist as its data says', () => {
    for (const word of [...(grid.axes?.top ?? []), ...(grid.axes?.side ?? [])])
      expect(labels(els)).toContain(word);
    const buttons = shapes(els, 'session-button');
    expect(buttons).toHaveLength(grid.rail ? 2 : 0);
    // A session tool needs the Session strip, so a board with a rail opens in Workshop.
    expect(templateEditorMode(kind)).toBe(grid.rail ? 'workshop' : 'diagram');
    const items = shapes(els, 'checklist').flatMap((c) => c.checklistItems!.map((i) => i.text));
    expect(items).toEqual([...(grid.closing?.items ?? [])]);
  });
});

describe('the Concept Map', () => {
  const els = buildTemplate('concept-map', 0, 0);
  const ids = new Map(els.map((e) => [e.id, e]));

  it('links concepts only, every link carrying its linking words', () => {
    const links = arrows(els);
    expect(links.length).toBe(13);
    for (const a of links) {
      expect(a.from.kind).toBe('pinned');
      expect(a.to.kind).toBe('pinned');
      expect(a.label?.length, a.id).toBeGreaterThan(0);
    }
  });

  it('reads as sentences: Photosynthesis needs Sunlight, and two dashed cross-links', () => {
    const said = arrows(els).map((a) => {
      const from = a.from.kind === 'pinned' ? (ids.get(a.from.elementId) as ShapeElement) : null;
      const to = a.to.kind === 'pinned' ? (ids.get(a.to.elementId) as ShapeElement) : null;
      return `${from?.label} ${a.label} ${to?.label}`;
    });
    expect(said).toContain('Photosynthesis needs Sunlight');
    expect(said).toContain('Leaves contain Chlorophyll');
    expect(arrows(els).filter((a) => a.strokeStyle === 'dashed')).toHaveLength(2);
  });
});

describe('the Network Diagram', () => {
  const els = buildTemplate('network-diagram', 0, 0);
  const vlans = shapes(els, 'boundary');
  const cards = shapes(els, 'card');

  it('draws three VLANs with their subnets, each holding its two devices', () => {
    expect(vlans.map((v) => v.pageSubtitle)).toEqual([
      '10.0.10.0/24',
      '10.0.20.0/24',
      '10.0.30.0/24',
    ]);
    for (const v of vlans)
      expect(
        cards.filter((c) => inside(c, v)),
        v.label,
      ).toHaveLength(2);
  });

  it('draws links as a network is drawn: no arrowheads, a pattern for cable, Wi-Fi and VPN', () => {
    const links = arrows(els);
    for (const a of links) {
      expect(a.arrowEnds, a.label).toBe('none');
      expect(a.label?.length, a.id).toBeGreaterThan(0);
    }
    expect(new Set(links.map((a) => a.strokeStyle ?? 'solid'))).toEqual(
      new Set(['solid', 'dashed', 'dotted']),
    );
    expect(shapes(els, 'diagram-key')[0]!.keyRows).toHaveLength(3);
  });
});
