import type { ArrowElement, Element, Tab, ThemeDefinition } from '@livediagram/diagram';
import { COMPONENT_SIZE } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { ES_BOARD_LAYER_ID, eventStormingLayers } from '@livediagram/diagram';
import {
  buildDrawnArrow,
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

const tab = (overrides: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], ...overrides }) as unknown as Tab;

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

  it('snaps a dragged endpoint onto a nearby arrow (spec/50), leaving the far one free', () => {
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

  it('sizes to the dragged box, per axis, so the layout re-flows (spec/147)', () => {
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

  it("seeds the tab's default text size (spec/28)", () => {
    const seeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab({ defaultTextSize: 'lg' }));
    expect(seeded.textSize).toBe('lg');
    const unseeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab());
    expect(unseeded.textSize).toBe('md'); // the shape factory's own default
  });

  it('carries an event-storming fill onto a drawn sticky (spec/139)', () => {
    // The Event Storming palette tiles arm a sticky intent with the note
    // kind's canonical fill; the commit must land it as the element's
    // fillColor (stickies are theme-exempt, so it then survives themes).
    const out = buildDrawnBoxed({ type: 'sticky', fill: '#fdba74' }, 0, 0, 3, 3, null, tab());
    expect(out).toMatchObject({ type: 'sticky', fillColor: '#fdba74' });
    // A plain sticky stays exactly as it was: no fillColor sneaks in.
    const plain = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 3, 3, null, tab());
    expect('fillColor' in plain && plain.fillColor != null).toBe(false);
  });

  // The workshop stationery (spec/139): on an event-storming board every
  // sticky drops with a random hand-placed tilt and a FIXED silhouette —
  // no resizing, and a drag gesture sizes nothing.
  it('gives any sticky on an ES board a tilt and a fixed size; drag sizes nothing', () => {
    const esTab = tab({ layers: eventStormingLayers() });
    // A big drag: on an ES board it must be ignored (fixed silhouette).
    const dragged = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 500, 400, null, esTab);
    expect(dragged.width).toBe(200);
    expect(dragged.height).toBe(200);
    expect((dragged as { fixedSize?: boolean }).fixedSize).toBe(true);
    expect(typeof dragged.rotation).toBe('number');
    expect(Math.abs(dragged.rotation!)).toBeLessThanOrEqual(1.1);
    // Off-board: everything stays classic — drag sizes, no tilt, no flag.
    const off = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 500, 400, null, tab());
    expect(off.width).toBe(500);
    expect((off as { fixedSize?: boolean }).fixedSize).toBeUndefined();
    expect(off.rotation).toBeUndefined();
    // Tap-inheritance must not leak either: a selected 320×100 element
    // cannot bend the stationery silhouette.
    const wide = { id: 'w', type: 'sticky', x: 0, y: 0, width: 320, height: 100 } as Element;
    const inherited = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 3, 3, wide, esTab);
    expect({ width: inherited.width, height: inherited.height }).toEqual({
      width: 200,
      height: 200,
    });
  });

  it('stamps the notation kind on the element (it is domain data, not a colour)', () => {
    const esTab = tab({ layers: eventStormingLayers() });
    const cmd = buildDrawnBoxed(
      { type: 'sticky', fill: '#93c5fd', esKind: 'command' },
      0,
      0,
      3,
      3,
      null,
      esTab,
    );
    expect((cmd as { esKind?: string }).esKind).toBe('command');
    // A plain sticky claims no kind.
    const plain = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 3, 3, null, esTab);
    expect((plain as { esKind?: string }).esKind).toBeUndefined();
  });

  it('sizes event-storming notes like the stationery set (wide policy, small actor)', () => {
    const esTab = tab({ layers: eventStormingLayers() });
    const policy = buildDrawnBoxed(
      { type: 'sticky', fill: '#d8b4fe', esKind: 'policy' },
      0,
      0,
      3,
      3,
      null,
      esTab,
    );
    expect({ width: policy.width, height: policy.height }).toEqual({ width: 300, height: 180 });
    const actor = buildDrawnBoxed(
      { type: 'sticky', fill: '#fef08a', esKind: 'actor' },
      0,
      0,
      3,
      3,
      null,
      esTab,
    );
    expect({ width: actor.width, height: actor.height }).toEqual({ width: 140, height: 140 });
    // A kinded note keeps its silhouette even OFF an ES board (the kind is
    // the notation), but stays freely resizable there: no fixedSize stamp.
    const offPolicy = buildDrawnBoxed(
      { type: 'sticky', fill: '#d8b4fe', esKind: 'policy' },
      0,
      0,
      3,
      3,
      null,
      tab(),
    );
    expect({ width: offPolicy.width, height: offPolicy.height }).toEqual({
      width: 300,
      height: 180,
    });
    expect((offPolicy as { fixedSize?: boolean }).fixedSize).toBeUndefined();
  });

  // Layer routing (spec/139): an event-storming board has ONE layer, and
  // every note files onto it whatever its kind — stage bands meant two notes
  // could never be stacked against each other.
  it('routes every event-storming note onto the board layer', () => {
    const esTab = tab({ layers: eventStormingLayers() });
    const cmd = buildDrawnBoxed(
      { type: 'sticky', fill: '#93c5fd', esKind: 'command' },
      0,
      0,
      3,
      3,
      null,
      esTab,
    );
    expect(cmd.layerId).toBe(ES_BOARD_LAYER_ID);
    const evt = buildDrawnBoxed(
      { type: 'sticky', fill: '#fdba74', esKind: 'domain-event' },
      0,
      0,
      3,
      3,
      null,
      esTab,
    );
    expect(evt.layerId).toBe(ES_BOARD_LAYER_ID);
  });

  it('leaves routing alone off-board, and when the board layer is hidden or locked', () => {
    // Not an event-storming board: no stamp — the ordinary active-layer
    // stamping at the commit choke point applies.
    const off = buildDrawnBoxed(
      { type: 'sticky', fill: '#93c5fd', esKind: 'command' },
      0,
      0,
      3,
      3,
      null,
      tab(),
    );
    expect(off.layerId).toBeUndefined();
    // Hidden target: stamping would create an element the user can't see.
    const hidden = tab({
      layers: eventStormingLayers().map((l) =>
        l.id === ES_BOARD_LAYER_ID ? { ...l, visible: false } : l,
      ),
    });
    expect(
      buildDrawnBoxed(
        { type: 'sticky', fill: '#93c5fd', esKind: 'command' },
        0,
        0,
        3,
        3,
        null,
        hidden,
      ).layerId,
    ).toBeUndefined();
    // Locked target: stamping would create an element the user can't touch.
    const locked = tab({
      layers: eventStormingLayers().map((l) =>
        l.id === ES_BOARD_LAYER_ID ? { ...l, locked: true } : l,
      ),
    });
    expect(
      buildDrawnBoxed(
        { type: 'sticky', fill: '#93c5fd', esKind: 'command' },
        0,
        0,
        3,
        3,
        null,
        locked,
      ).layerId,
    ).toBeUndefined();
  });

  it('carries the icon glyph + label, unlocking aspect for a tech mark (spec/41)', () => {
    const intent = { type: 'shape', kind: 'square', iconId: 'aws-s3', label: 'S3' } as const;
    const out = buildDrawnBoxed(intent, 0, 0, 100, 100, null, tab());
    expect(out).toMatchObject({ iconId: 'aws-s3', label: 'S3', aspectLocked: false });
  });

  // The kinds that used to drop at the viewport centre with no draw gesture
  // at all (spec/09 "Placement on add"). A tap keeps the factory default, a
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

  it('draws a link card to the dragged box (spec/40)', () => {
    const out = buildDrawnBoxed({ type: 'link-card' }, 10, 10, 210, 110, null, tab());
    expect(out).toMatchObject({ type: 'link-card', x: 10, y: 10, width: 200, height: 100 });
  });

  it('carries the embed provider through the gesture, so the tile you pressed is what lands', () => {
    const out = buildDrawnBoxed({ type: 'video', provider: 'figma' }, 0, 0, 3, 3, null, tab());
    expect(out).toMatchObject({ type: 'video', embedProvider: 'figma' });
  });

  it('fits an embed to 16:9 inside the drawn box rather than stretching it (spec/114)', () => {
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
    const out = buildDrawnBoxed({ type: 'image' }, 40, 60, 240, 160, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 40,
      y: 60,
      width: 200,
      height: 100,
    });
  });
});
