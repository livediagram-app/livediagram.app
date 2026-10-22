import { describe, expect, it } from 'vitest';
import { EMBED_PROVIDERS } from '@liveplanner/document';
import {
  drawBannerMessage,
  drawIntentCursor,
  isPlanCardIntent,
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
  table: [{ type: 'table' }],
  'link-card': [{ type: 'link-card' }],
  // Every provider, plus the no-provider case the empty state falls back on.
  // The banner names the service, so a new EMBED_PROVIDERS member without a
  // label would otherwise reach the user as "undefined".
  video: [
    { type: 'video' },
    ...EMBED_PROVIDERS.map((provider): PendingDraw => ({ type: 'video', provider })),
  ],
  arrow: [{ type: 'arrow' }],
  polygon: [{ type: 'polygon' }],
  // Component kinds share one branch and one label table that is already a
  // Record<ComponentKind, string>, so the compiler covers that axis; one
  // sample is enough here.
  component: [{ type: 'component', kind: 'banner' }],
};

const ALL_INTENTS: PendingDraw[] = Object.values(INTENT_SAMPLES).flat();

describe('drawBannerMessage', () => {
  it('tells a pressed Plan card where it goes, or that a board comes first', () => {
    const card = { type: 'shape', kind: 'plan-card' } as const;
    expect(drawBannerMessage(card, false, { hasPlanBoard: true })).toBe(
      'Select the board column you want this card to appear in',
    );
    expect(drawBannerMessage(card, false)).toBe('Add a board first in order to use cards');
    expect(drawBannerMessage({ type: 'shape', kind: 'square' }, false)).toContain('Tap to drop');
  });

  it('says a workshop note is placed, not drawn (docs/specs/021-event-storming/event-storming.md)', () => {
    expect(drawBannerMessage({ type: 'sticky', esKind: 'command' }, false)).toBe(
      'Click to place a command note',
    );
    expect(drawBannerMessage({ type: 'sticky', esKind: 'command' }, true)).toBe(
      'Tap to place a command note',
    );
  });

  // docs/specs/008-canvas/canvas-and-palette.md: the banner names a shape as the tile that armed it named it.
  it('names a shape as its tile does, a variant or a compound kind included', () => {
    expect(
      drawBannerMessage(
        { type: 'shape', kind: 'pyramid', variant: 'funnel', name: 'Funnel' },
        false,
      ),
    ).toBe('Tap to drop or drag to draw Funnel');
    expect(drawBannerMessage({ type: 'shape', kind: 'hub', name: 'Hub and Spoke' }, false)).toBe(
      'Tap to drop or drag to draw Hub and Spoke',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'square' }, false)).toBe(
      'Tap to drop or drag to draw Square',
    );
  });

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
    expect(drawBannerMessage({ type: 'table' }, false)).toBe('Tap to drop or drag to draw a table');
    expect(drawBannerMessage({ type: 'arrow', ends: 'none' }, false)).toBe(
      'Tap to drop or drag to draw a line',
    );
    expect(drawBannerMessage({ type: 'link-card' }, false)).toBe(
      'Tap to drop or drag to draw a link card',
    );
  });

  it('names the embed service rather than saying "video" for all six', () => {
    expect(drawBannerMessage({ type: 'video', provider: 'loom' }, false)).toBe(
      'Tap to drop or drag to draw Loom (stays 16:9)',
    );
    expect(drawBannerMessage({ type: 'video', provider: 'gdocs' }, false)).toBe(
      'Tap to drop or drag to draw Google Docs (stays 16:9)',
    );
    // No provider = the generic website embed, not a blank.
    expect(drawBannerMessage({ type: 'video' }, false)).toBe(
      'Tap to drop or drag to draw Website (stays 16:9)',
    );
  });

  it('drops the 16:9 note on mobile, where it overflows the banner', () => {
    expect(drawBannerMessage({ type: 'video', provider: 'vimeo' }, true)).toBe(
      'Tap to drop or drag to draw Vimeo',
    );
  });

  // The banner names the shape as the tile just picked does: the palette's Square and Circle (and the selection
  // badge's).
  it('names the shape as the tile that armed it', () => {
    expect(drawBannerMessage({ type: 'shape', kind: 'square' }, false)).toBe(
      'Tap to drop or drag to draw Square',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'circle' }, false)).toBe(
      'Tap to drop or drag to draw Circle',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'diamond' }, false)).toBe(
      'Tap to drop or drag to draw Diamond',
    );
    expect(drawBannerMessage({ type: 'shape', kind: 'pie-chart' }, false)).toBe(
      'Tap to drop or drag to draw Pie chart',
    );
  });

  it('spells out a hyphenated kind instead of leaving the hyphen in', () => {
    // 'Code-block' is the capitalise-the-first-letter fallback showing through; it is a two-word name.
    expect(drawBannerMessage({ type: 'shape', kind: 'code-block' }, false)).toBe(
      'Tap to drop or drag to draw Code block',
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

  it('describes the polygon click-to-place gesture, shortened on mobile', () => {
    expect(drawBannerMessage({ type: 'polygon' }, false)).toBe(
      'Click to place points, click the start to close, double-click to finish',
    );
    expect(drawBannerMessage({ type: 'polygon' }, true)).toBe('Tap to place points');
  });

  it('uses the friendly component name, not the raw kind', () => {
    // Components have their own label table rather than the shape
    // capitalise-fallback, so 'stat' reads "Stat row" and not "Stat".
    expect(drawBannerMessage({ type: 'component', kind: 'banner' }, false)).toBe(
      'Tap to drop or drag to draw Banner',
    );
    expect(drawBannerMessage({ type: 'component', kind: 'stat' }, false)).toBe(
      'Tap to drop or drag to draw Stat row',
    );
    expect(drawBannerMessage({ type: 'component', kind: 'process' }, false)).toBe(
      'Tap to drop or drag to draw Process steps',
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
      { type: 'arrow' },
      { type: 'polygon' },
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
    for (const kind of ['banner', 'hero', 'avatar'] as const) {
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
  it('opens a drawn text box for typing everywhere', () => {
    expect(opensForTyping({ type: 'text' })).toBe(true);
    expect(opensForTyping({ type: 'sticky' })).toBe(false);
  });

  it('leaves shapes selected, not typing', () => {
    expect(opensForTyping({ type: 'shape', kind: 'square' })).toBe(false);
  });
});

describe('a pressed Plan card (docs/specs/026-plan/plan-mode.md "The palette")', () => {
  it('is told apart from every other shape in hand', () => {
    expect(isPlanCardIntent({ type: 'shape', kind: 'plan-card', plan: 'task' })).toBe(true);
    expect(isPlanCardIntent({ type: 'shape', kind: 'plan-board' })).toBe(false);
    expect(isPlanCardIntent({ type: 'text' })).toBe(false);
    expect(isPlanCardIntent(null)).toBe(false);
  });
});
