import { describe, expect, it } from 'vitest';
import {
  drawBannerMessage,
  drawIntentCursor,
  dropsOnTap,
  isWhiteboardOnlyIntent,
  opensForTyping,
  type PendingDraw,
} from './draw-mode';

// One sample per discriminant. Typing it as a Record over PendingDraw['type']
// means a NEW intent type also fails to compile until it's represented, so
// neither axis of the union can drift out of the sweeps again.
const INTENT_SAMPLES: Record<PendingDraw['type'], PendingDraw[]> = {
  shape: [{ type: 'shape', kind: 'square' }],
  text: [{ type: 'text' }],
  sticky: [{ type: 'sticky' }],
  image: [{ type: 'image' }],
  'link-card': [{ type: 'link-card' }],
  'room-walls': [{ type: 'room-walls' }],
  // Component kinds share one branch and one label table that is already a
  // Record<ComponentKind, string>, so the compiler covers that axis; one
  // sample is enough here.
  component: [{ type: 'component', kind: 'avatar' }],
};

const ALL_INTENTS: PendingDraw[] = Object.values(INTENT_SAMPLES).flat();

describe('drawBannerMessage', () => {
  it('renders the combined tap/drag copy per box intent', () => {
    expect(drawBannerMessage({ type: 'text' }, false)).toBe('Click to drop or drag to place text');
    expect(drawBannerMessage({ type: 'sticky' }, false)).toBe(
      'Click to drop or drag to draw a sticky note',
    );
    expect(drawBannerMessage({ type: 'image' }, false)).toBe(
      'Click to drop or drag to draw image bounds',
    );
    expect(drawBannerMessage({ type: 'link-card' }, false)).toBe(
      'Click to drop or drag to draw a link card',
    );
  });

  // The banner names the shape as the tile just picked does: the palette's Square and Circle (and the selection
  // badge's), Draw mode's dock its Rectangle and Ellipse. Its own aliases (Rectangle, Oval) matched neither.
  it('names the shape as the tile that armed it', () => {
    expect(drawBannerMessage({ type: 'shape', kind: 'square' }, false)).toBe(
      'Click to drop or drag to draw Square',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'circle' }, false)).toBe(
      'Click to drop or drag to draw Circle',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'square', board: true }, false)).toBe(
      'Click to drop or drag to draw Rectangle',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'circle', board: true }, false)).toBe(
      'Click to drop or drag to draw Ellipse',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'diamond' }, false)).toBe(
      'Click to drop or drag to draw Diamond',
    );
  });

  it('spells out a hyphenated kind instead of leaving the hyphen in', () => {
    // 'Mode-button' / 'Water-cooler' is the capitalise-the-first-letter fallback
    // showing through; these are two-word names.
    expect(drawBannerMessage({ type: 'shape', kind: 'mode-button' }, false)).toBe(
      'Click to drop or drag to draw Mode button',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'water-cooler' }, false)).toBe(
      'Click to drop or drag to draw Water cooler',
    );
  });

  it('capitalises any other shape kind for the banner', () => {
    expect(drawBannerMessage({ type: 'shape', kind: 'cylinder' }, false)).toBe(
      'Click to drop or drag to draw Cylinder',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'hexagon' }, false)).toBe(
      'Click to drop or drag to draw Hexagon',
    );
  });

  it('describes the Room Builder, shortened on mobile', () => {
    expect(drawBannerMessage({ type: 'room-walls' }, false)).toBe(
      'Click to place corners, click the start to close',
    );
    expect(drawBannerMessage({ type: 'room-walls' }, true)).toBe('Tap to place corners');
  });

  it('uses the friendly component name, not the raw kind', () => {
    // Components have their own label table rather than the shape
    // capitalise-fallback, so each reads as its palette tile does.
    expect(drawBannerMessage({ type: 'component', kind: 'avatar' }, false)).toBe(
      'Click to drop or drag to draw Avatar',
    );
  });

  it('returns a non-empty string for every intent on both viewports', () => {
    for (const intent of ALL_INTENTS) {
      expect(drawBannerMessage(intent, false).length).toBeGreaterThan(0);
      expect(drawBannerMessage(intent, true).length).toBeGreaterThan(0);
    }
  });
});

describe('drawIntentCursor', () => {
  // The shared builder anchors every custom cursor's crosshair at the
  // (4,4) hotspot and ends in a `crosshair` system fallback.
  const isInlineSvgCursor = (c: string) =>
    c.startsWith('url("data:image/svg+xml') && c.endsWith('4 4, crosshair');

  it('returns an inline-SVG cursor (4,4 hotspot) for every non-shape intent', () => {
    for (const intent of [
      { type: 'text' },
      { type: 'sticky' },
      { type: 'image' },
      { type: 'link-card' },
      { type: 'room-walls' },
    ] as PendingDraw[]) {
      expect(isInlineSvgCursor(drawIntentCursor(intent))).toBe(true);
    }
  });

  it('gives square / circle / diamond a custom glyph cursor', () => {
    for (const kind of ['square', 'circle', 'diamond'] as const) {
      expect(isInlineSvgCursor(drawIntentCursor({ type: 'shape', kind }))).toBe(true);
    }
  });

  it('falls back to the plain system crosshair for shape kinds without a glyph', () => {
    // The banner already names the kind, so non-special shapes don't need
    // a bespoke cursor and use the system crosshair.
    expect(drawIntentCursor({ type: 'shape', kind: 'cylinder' })).toBe('crosshair');
    expect(drawIntentCursor({ type: 'shape', kind: 'cloud' })).toBe('crosshair');
  });

  it('gives every component kind the stacked-blocks glyph cursor', () => {
    // One cursor for the whole category (matching the Components palette
    // tile), so the kind doesn't change it.
    for (const kind of ['avatar'] as const) {
      expect(isInlineSvgCursor(drawIntentCursor({ type: 'component', kind }))).toBe(true);
    }
  });

  it('never returns an empty or inherited ("auto") cursor', () => {
    for (const intent of [...ALL_INTENTS, { type: 'shape', kind: 'cloud' } as PendingDraw]) {
      const c = drawIntentCursor(intent);
      expect(c).toBeTruthy();
      expect(c).not.toBe('auto');
    }
  });
});

describe('opensForTyping', () => {
  it('opens a drawn text box for typing', () => {
    expect(opensForTyping({ type: 'text' })).toBe(true);
  });

  it('leaves stickies and shapes selected, not typing', () => {
    expect(opensForTyping({ type: 'sticky' })).toBe(false);
    expect(opensForTyping({ type: 'shape', kind: 'square' })).toBe(false);
  });
});

describe('isWhiteboardOnlyIntent', () => {
  it('holds for a shape armed from the board, not a palette shape', () => {
    expect(isWhiteboardOnlyIntent({ type: 'shape', kind: 'square', board: true })).toBe(true);
    expect(isWhiteboardOnlyIntent({ type: 'shape', kind: 'square' })).toBe(false);
    expect(isWhiteboardOnlyIntent({ type: 'sticky' })).toBe(false);
    expect(isWhiteboardOnlyIntent(null)).toBe(false);
  });
});

// Enter drops an armed tile at the middle of the view, as a tap would (docs/specs/008-canvas/canvas-and-palette.md
// "Adding elements"); a gesture with no tap leaves Enter alone.
describe('dropsOnTap', () => {
  it('holds for every box and component', () => {
    const taps: PendingDraw[] = [
      { type: 'shape', kind: 'circle' },
      { type: 'text' },
      { type: 'sticky' },
      { type: 'image' },
      { type: 'link-card' },
      { type: 'component', kind: 'avatar' },
    ];
    for (const intent of taps) expect(dropsOnTap(intent)).toBe(true);
  });

  it('fails for the Room Builder and nothing armed', () => {
    expect(dropsOnTap({ type: 'room-walls' })).toBe(false);
    expect(dropsOnTap(null)).toBe(false);
  });
});
