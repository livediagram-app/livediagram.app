import { describe, expect, it } from 'vitest';
import { createShape, type ArrowElement, type ShapeElement } from '@livediagram/document';
import {
  ADD,
  CHAPTERS,
  CONNECT,
  DEMO_IDS,
  LABEL,
  STYLE,
  TOTAL_MS,
  cursorPlan,
  demoAt,
  type ReplayLayout,
} from './watch-it-built-script';

// Watch It Built's script (docs/specs/007-editor/watch-it-built.md "The replay"): a pure function of (chapter, ms), so
// a pause, a chapter press and reduced motion's Next are only a different moment.

const shape = (id: string, label: string, y: number): ShapeElement => ({
  ...createShape('square', 0, 0),
  id,
  label,
  x: 100,
  y,
  width: 200,
  height: 60,
});
const a = shape(DEMO_IDS.a, 'Order received', 0);
const b = shape(DEMO_IDS.b, '', 200);
const arrow = {
  id: DEMO_IDS.arrow,
  type: 'arrow',
  from: { kind: 'pinned', elementId: a.id, anchor: 'bottom' },
  to: { kind: 'pinned', elementId: b.id, anchor: 'top' },
} as unknown as ArrowElement;
const green: ShapeElement = {
  ...b,
  fillColor: '#dcfce7',
  strokeColor: '#16a34a',
  colorPreset: 'success',
};
const layout: ReplayLayout = { a, b, arrow, green, tile: { x: 20, y: -300 } };

const at = (id: string, ms: number) =>
  demoAt(
    CHAPTERS.findIndex((c) => c.id === id),
    ms,
    layout,
  );
const byId = (frame: ReturnType<typeof demoAt>, id: string) =>
  frame.elements.find((e) => e.id === id);

describe('CHAPTERS', () => {
  it('plays Add, Connect, Label, Style, adding up to TOTAL_MS', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['add', 'connect', 'label', 'style']);
    expect(TOTAL_MS).toBe(CHAPTERS.reduce((sum, c) => sum + c.ms, 0));
  });

  it('words every line for touch, never with an em dash', () => {
    for (const c of CHAPTERS) {
      expect(c.sayTouch).not.toBe(c.say);
      expect(`${c.say} ${c.sayTouch} ${c.name} ${c.shortName}`).not.toMatch(/—/);
    }
  });
});

describe('demoAt: Add', () => {
  it('holds A unseen where it lands before the drag, for the host to measure', () => {
    const frame = at('add', 0);
    expect(frame.elements).toEqual([{ ...a, opacity: 0 }]);
    expect(frame.paletteOpen).toBe(false);
  });

  it('opens the palette for each carry and closes it once the shape is out', () => {
    expect(at('add', ADD.open1).paletteOpen).toBe(true);
    expect(at('add', ADD.drag1[0] + 100).paletteOpen).toBe(true);
    expect(at('add', ADD.drag1[0] + 300).paletteOpen).toBe(false);
    expect(at('add', ADD.open2).paletteOpen).toBe(true);
    expect(at('add', ADD.drag2[1]).paletteOpen).toBe(false);
  });

  it('carries A from the palette tile, its centre on the tile, to where it lands', () => {
    const start = byId(at('add', ADD.drag1[0]), a.id) as ShapeElement;
    expect(start.x + start.width / 2).toBe(20);
    expect(start.y + start.height / 2).toBe(-300);
    const mid = byId(at('add', (ADD.drag1[0] + ADD.drag1[1]) / 2), a.id) as ShapeElement;
    expect(mid.y).toBeGreaterThan(start.y);
    expect(mid.y).toBeLessThan(a.y);
    expect(byId(at('add', ADD.drag1[1]), a.id)).toEqual(a);
  });

  it('drops a carried shape where it lands when the tile was never seen', () => {
    const frame = demoAt(0, ADD.drag1[0] + 10, { ...layout, tile: null });
    expect(byId(frame, a.id)).toEqual(a);
  });

  it('carries B in blank after A, and ends with both landed', () => {
    expect(byId(at('add', ADD.drag2[0] - 1), b.id)).toBeUndefined();
    const end = at('add', CHAPTERS[0]!.ms);
    expect(end.elements).toEqual([a, { ...b, label: '' }]);
  });
});

describe('demoAt: Connect', () => {
  it('selects A, then drags a loose arrow end from A to B, then pins it', () => {
    expect(at('connect', 0).selectedId).toBeNull();
    expect(at('connect', CONNECT.select).selectedId).toBe(a.id);
    const dragging = at('connect', (CONNECT.drag[0] + CONNECT.drag[1]) / 2);
    const loose = byId(dragging, arrow.id) as ArrowElement;
    expect(loose.to.kind).toBe('free');
    expect(loose.from).toEqual(arrow.from);
    const done = at('connect', CONNECT.drag[1]);
    expect(byId(done, arrow.id)).toEqual(arrow);
    expect(done.selectedId).toBe(arrow.id);
    expect(at('connect', CHAPTERS[1]!.ms).selectedId).toBeNull();
  });

  it('moves the loose end from A towards B', () => {
    const early = byId(at('connect', CONNECT.drag[0] + 100), arrow.id) as ArrowElement;
    const late = byId(at('connect', CONNECT.drag[1] - 100), arrow.id) as ArrowElement;
    if (early.to.kind !== 'free' || late.to.kind !== 'free') throw new Error('expected free ends');
    expect(late.to.y).toBeGreaterThan(early.to.y);
    expect(late.to.y).toBeLessThanOrEqual(b.y);
  });
});

describe('demoAt: Label', () => {
  it('types "Check stock" into B letter by letter, with a caret while typing', () => {
    expect((byId(at('label', LABEL.select), b.id) as ShapeElement).label).toBe('');
    expect(at('label', LABEL.select).typing).toBe(true);
    const mid =
      (byId(at('label', (LABEL.type[0] + LABEL.type[1]) / 2), b.id) as ShapeElement).label ?? '';
    expect(mid.length).toBeGreaterThan(0);
    expect('Check stock'.startsWith(mid)).toBe(true);
    expect((byId(at('label', LABEL.type[1]), b.id) as ShapeElement).label).toBe('Check stock');
    expect(at('label', CHAPTERS[2]!.ms).typing).toBe(false);
  });
});

describe('demoAt: Style', () => {
  it('opens the menu on B, goes into Style then Presets, and picks the green look', () => {
    expect(at('style', 0).menuOnB).toBe(false);
    expect(at('style', STYLE.menu)).toMatchObject({
      menuOnB: true,
      menuDepth: 0,
      selectedId: b.id,
    });
    expect(at('style', STYLE.flyout).menuDepth).toBe(1);
    expect(at('style', STYLE.presets).menuDepth).toBe(2);
    expect((byId(at('style', STYLE.pick - 1), b.id) as ShapeElement).fillColor).toBe(b.fillColor);
    const picked = byId(at('style', STYLE.pick), b.id) as ShapeElement;
    expect(picked).toMatchObject({
      fillColor: '#dcfce7',
      colorPreset: 'success',
      label: 'Check stock',
    });
    expect(at('style', STYLE.close).menuOnB).toBe(false);
  });

  it('clamps a chapter index past the end to the last chapter', () => {
    expect(demoAt(99, STYLE.pick, layout)).toEqual(at('style', STYLE.pick));
  });
});

describe('cursorPlan', () => {
  it('reaches every waypoint inside its chapter, in time order', () => {
    CHAPTERS.forEach((chapter, i) => {
      const times = cursorPlan(i).map((w) => w.at);
      expect(times.length).toBeGreaterThan(0);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
      expect(Math.max(...times)).toBeLessThan(chapter.ms);
    });
  });

  it('presses through the menu by the words on its rows', () => {
    const names = cursorPlan(3).flatMap((w) => (w.to.kind === 'menu' ? [w.to.name] : []));
    expect(names).toEqual(['Style', 'Presets', 'Success']);
  });

  it('falls back to the first chapter for an unknown index', () => {
    expect(cursorPlan(-1)).toEqual(cursorPlan(0));
  });
});
