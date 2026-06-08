import { describe, expect, it } from 'vitest';
import { drawBannerMessage, drawIntentCursor, type PendingDraw } from './draw-mode';

const ALL_INTENTS: PendingDraw[] = [
  { type: 'shape', kind: 'square' },
  { type: 'text' },
  { type: 'sticky' },
  { type: 'image' },
  { type: 'arrow' },
  { type: 'freehand' },
];

describe('drawBannerMessage', () => {
  it('renders the combined tap/drag copy per box intent', () => {
    expect(drawBannerMessage({ type: 'text' }, false)).toBe('Tap to drop or drag to place text');
    expect(drawBannerMessage({ type: 'sticky' }, false)).toBe(
      'Tap to drop or drag to draw a sticky note',
    );
    expect(drawBannerMessage({ type: 'image' }, false)).toBe(
      'Tap to drop or drag to draw image bounds',
    );
    expect(drawBannerMessage({ type: 'arrow' }, false)).toBe(
      'Tap to drop or drag to draw an arrow',
    );
  });

  it('uses the friendly shape label (square->Rectangle, circle->Oval) in the shape copy', () => {
    expect(drawBannerMessage({ type: 'shape', kind: 'square' }, false)).toBe(
      'Tap to drop or drag to draw Rectangle',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'circle' }, false)).toBe(
      'Tap to drop or drag to draw Oval',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'diamond' }, false)).toBe(
      'Tap to drop or drag to draw Diamond',
    );
  });

  it('capitalises any other shape kind for the banner', () => {
    expect(drawBannerMessage({ type: 'shape', kind: 'cylinder' }, false)).toBe(
      'Tap to drop or drag to draw Cylinder',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'hexagon' }, false)).toBe(
      'Tap to drop or drag to draw Hexagon',
    );
  });

  it('keeps freehand gestural-only, with the close hint only on desktop', () => {
    // The pencil collects a pointer stream (no tap-to-drop), so it keeps
    // "Drag to draw"; the release-near-start hint overflows the mobile
    // banner so phones get the bare copy.
    expect(drawBannerMessage({ type: 'freehand' }, false)).toBe(
      'Drag to draw (release near the start to close)',
    );
    expect(drawBannerMessage({ type: 'freehand' }, true)).toBe('Drag to draw');
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
      { type: 'arrow' },
      { type: 'freehand' },
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

  it('never returns an empty or inherited ("auto") cursor', () => {
    for (const intent of [...ALL_INTENTS, { type: 'shape', kind: 'cloud' } as PendingDraw]) {
      const c = drawIntentCursor(intent);
      expect(c).toBeTruthy();
      expect(c).not.toBe('auto');
    }
  });
});
