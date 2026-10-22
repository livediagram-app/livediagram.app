import type { ArrowElement, Element, Tab, ThemeDefinition } from '@liveplanner/project';
import { COMPONENT_SIZE } from '@liveplanner/project';
import { describe, expect, it } from 'vitest';
import { PLAN_SHEET_ID_PATTERN } from '@liveplanner/project';
import { takePlacedSheet } from './sheet-seeds';
import {
  buildDrawnArrow,
  buildDressedDrawnArrow,
  buildDrawnBoxed,
  buildDrawnComponent,
  NEW_ARROW_THEME_STROKE_FALLBACK,
} from './draw-commit';

// Only the fields the builders read; the full ThemeDefinition carries a
// dozen backdrop fields irrelevant here.
const themed = {
  elementStroke: '#123456',
  elementFill: '#fafafa',
  elementText: '#111111',
} as unknown as ThemeDefinition;
const bareTheme = {} as unknown as ThemeDefinition;

const tab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: [],
  ...overrides,
});

// The preview and the commit build one arrow.
describe('buildDressedDrawnArrow', () => {
  const thick = <T extends Element>(el: T): T => ({
    ...el,
    strokeWidth: 6,
    arrowheadSize: 'large',
  });
  const board = { elements: [] as Element[], theme: themed };

  it('paints a diagram arrow in the theme stroke, then dresses it', () => {
    const out = buildDressedDrawnArrow({ type: 'arrow' }, 0, 0, 100, 0, board, thick);
    expect(out.strokeColor).toBe('#123456');
    expect(out.strokeWidth).toBe(6);
    expect(out.arrowEnds).toBe('none');
  });

  it('lands the tap placeholder while the drag is still a tap', () => {
    const out = buildDressedDrawnArrow({ type: 'arrow' }, 500, 300, 505, 302, board, (el) => el);
    expect(out.from).toEqual({ kind: 'free', x: 420, y: 300 });
    expect(out.to).toEqual({ kind: 'free', x: 580, y: 300 });
  });
});

describe('buildDrawnArrow', () => {
  it('lays a flat 160px placeholder across a stray click, unsnapped', () => {
    const out = buildDrawnArrow(500, 300, 505, 310, [], themed); // <16px travel = click
    expect(out.from).toEqual({ kind: 'free', x: 420, y: 300 });
    expect(out.to).toEqual({ kind: 'free', x: 580, y: 300 });
    expect(out.arrowEnds).toBe('none');
    expect(out.strokeColor).toBe('#123456');
  });

  it('falls back to the brand stroke when the theme has no elementStroke', () => {
    const out = buildDrawnArrow(0, 0, 5, 5, [], bareTheme);
    expect(out.strokeColor).toBe(NEW_ARROW_THEME_STROKE_FALLBACK);
  });

  it('uses the dragged endpoints as-is on a real drag', () => {
    const out = buildDrawnArrow(10, 20, 150, 90, [], themed);
    expect(out.from).toEqual({ kind: 'free', x: 10, y: 20 });
    expect(out.to).toEqual({ kind: 'free', x: 150, y: 90 });
  });

  it('snaps a dragged endpoint onto a nearby arrow (docs/specs/008-canvas/arrow-to-arrow.md), leaving the far one free', () => {
    const existing: ArrowElement = {
      id: 'ex',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 100 },
      to: { kind: 'free', x: 200, y: 100 },
    };
    const out = buildDrawnArrow(50, 0, 100, 100, [existing], themed);
    expect(out.from).toEqual({ kind: 'free', x: 50, y: 0 });
    expect(out.to.kind).toBe('on-arrow');
    if (out.to.kind === 'on-arrow') {
      expect(out.to.arrowId).toBe('ex');
      expect(out.to.t).toBeCloseTo(0.5, 1);
    }
  });
});

describe('buildDrawnComponent', () => {
  it('drops one element at its natural size, centred on a tap', () => {
    const out = buildDrawnComponent('callout', 500, 300, 503, 302, themed);
    if (out.type === 'arrow') throw new Error('expected a boxed element');
    expect(out).toMatchObject(COMPONENT_SIZE.callout);
    expect(out.x + out.width / 2).toBe(500);
    expect(out.y + out.height / 2).toBe(300);
  });

  it('sizes to the dragged box, per axis, so the layout re-flows (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
    const out = buildDrawnComponent('stat', 10, 20, 910, 220, themed);
    expect(out).toMatchObject({ x: 10, y: 20, width: 900, height: 200 });
  });

  it('keeps an aspect-locked avatar square, centred in the dragged box', () => {
    const out = buildDrawnComponent('avatar', 0, 0, 300, 100, themed);
    expect(out).toMatchObject({ x: 100, y: 0, width: 100, height: 100 });
  });
});

describe('buildDrawnBoxed', () => {
  const shapeIntent = { type: 'shape', kind: 'square' } as const;

  it('keeps a Diagram mode text box at its default size, whatever the tab opens in', () => {
    const out = buildDrawnBoxed({ type: 'text' }, 500, 300, 502, 301, null, tab());
    expect(out).toMatchObject({ label: 'Text', width: 220, height: 64 });
    expect(out).not.toHaveProperty('sizing');
  });

  it('centres the factory-default size on a tap', () => {
    const out = buildDrawnBoxed(shapeIntent, 500, 300, 504, 303, null, tab());
    expect(out.width).toBe(120); // square factory default
    expect(out.height).toBe(120);
    expect(out.x).toBe(500 - 60);
    expect(out.y).toBe(300 - 60);
  });

  it('sizes to the dragged box, normalising a backwards drag', () => {
    const out = buildDrawnBoxed(shapeIntent, 200, 100, 10, 20, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 10,
      y: 20,
      width: 190,
      height: 80,
    });
  });

  it("seeds the tab's default text size (docs/specs/004-interface-design/fonts.md)", () => {
    const seeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab({ defaultTextSize: 'lg' }));
    expect(seeded.textSize).toBe('lg');
    const unseeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab());
    expect(unseeded.textSize).toBe('md'); // the shape factory's own default
  });

  it('carries the icon glyph + label, unlocking aspect for a tech mark (docs/specs/010-palette/technology-icons.md)', () => {
    const intent = { type: 'shape', kind: 'square', iconId: 'aws-s3', label: 'S3' } as const;
    const out = buildDrawnBoxed(intent, 0, 0, 100, 100, null, tab());
    expect(out).toMatchObject({ iconId: 'aws-s3', label: 'S3', aspectLocked: false });
  });

  // The kinds that used to drop at the viewport centre with no draw gesture
  // at all (docs/specs/008-canvas/canvas-and-palette.md "Placement on add"). A tap keeps the factory default, a
  // drag sizes them like any other box.
  it('taps a table out at its factory default, and drags it to the drawn box', () => {
    const tapped = buildDrawnBoxed({ type: 'table' }, 500, 300, 503, 302, null, tab());
    expect(tapped).toMatchObject({ type: 'table', width: 360, height: 150 });
    expect(tapped.x).toBe(500 - 180);
    // The 3x3 grid divides whatever box it is given, so a drag is meaningful.
    const drawn = buildDrawnBoxed({ type: 'table' }, 0, 0, 600, 400, null, tab());
    expect({ width: drawn.width, height: drawn.height }).toEqual({ width: 600, height: 400 });
    expect(drawn.type === 'table' && drawn.cells).toHaveLength(3);
  });

  it('draws a link card to the dragged box (docs/specs/009-elements/link-cards.md)', () => {
    const out = buildDrawnBoxed({ type: 'link-card' }, 10, 10, 210, 110, null, tab());
    expect(out).toMatchObject({ type: 'link-card', x: 10, y: 10, width: 200, height: 100 });
  });

  it('carries the embed provider through the gesture, so the tile you pressed is what lands', () => {
    const out = buildDrawnBoxed({ type: 'video', provider: 'figma' }, 0, 0, 3, 3, null, tab());
    expect(out).toMatchObject({ type: 'video', embedProvider: 'figma' });
  });

  it('fits an embed to 16:9 inside the drawn box rather than stretching it (docs/specs/009-elements/youtube-video.md)', () => {
    // A tall, narrow drag: width is the binding constraint.
    const tall = buildDrawnBoxed({ type: 'video' }, 0, 0, 320, 400, null, tab());
    expect(tall.width).toBeCloseTo(320, 5);
    expect(tall.height).toBeCloseTo(180, 5);
    // A wide, short drag: height binds instead.
    const wide = buildDrawnBoxed({ type: 'video' }, 0, 0, 800, 180, null, tab());
    expect(wide.width).toBeCloseTo(320, 5);
    expect(wide.height).toBeCloseTo(180, 5);
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 5);
  });

  it('centres the fitted embed in the box the user drew, not in one corner', () => {
    const out = buildDrawnBoxed({ type: 'video' }, 0, 0, 320, 400, null, tab());
    // 180 tall inside a 400 tall drag = 110 of slack on each side.
    expect(out.y).toBeCloseTo(110, 5);
    expect(out.x).toBeCloseTo(0, 5);
  });

  it('leaves every other kind anchored at the drawn top-left, uncentred', () => {
    const out = buildDrawnBoxed({ type: 'link-card' }, 40, 60, 240, 160, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 40,
      y: 60,
      width: 200,
      height: 100,
    });
  });
});

// docs/specs/029-sheets/sheet.md "Placing a sheet": a drawn or tapped Sheet names a new sheet the Sheet then makes.
describe('buildDrawnBoxed for a Sheet', () => {
  it('names a new sheet after its tab, placed and waiting to be made', () => {
    const out = buildDrawnBoxed(
      { type: 'shape', kind: 'plan-sheet' },
      100,
      100,
      100,
      100,
      null,
      tab(),
    ) as {
      shape: string;
      planSheet: { sheetId: string };
    };
    expect(out.shape).toBe('plan-sheet');
    expect(out.planSheet.sheetId).toMatch(PLAN_SHEET_ID_PATTERN);
    expect(takePlacedSheet(out.planSheet.sheetId)).toEqual({ title: tab().name });
    expect(takePlacedSheet(out.planSheet.sheetId)).toBeNull();
  });

  // docs/specs/026-plan/plan-board.md "The board set-up": a board drawn on a tab is named after it.
  it('names a new board after its tab', () => {
    const out = buildDrawnBoxed(
      { type: 'shape', kind: 'plan-board', plan: 'kanban' },
      100,
      100,
      100,
      100,
      null,
      { ...tab(), name: 'Launch' },
    ) as { planBoard: { title: string } };
    expect(out.planBoard.title).toBe('Launch');
  });
});
