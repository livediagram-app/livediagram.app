import { describe, expect, it } from 'vitest';
import { EMBED_PROVIDERS } from '@livediagram/diagram';
import { drawBannerMessage, drawIntentCursor, type PendingDraw } from './draw-mode';

// Every pen variant, keyed so the compiler owns the list: `variant` is an
// optional union on the freehand intent, and adding a member to it fails
// this Record until a sample is added below. That check is here because the
// hand-written array underneath it drifted twice — 'shape-pen' (spec/115)
// and 'component' both shipped with dedicated branches in BOTH exported
// functions while the sweeps below walked straight past them.
type FreehandVariant = NonNullable<Extract<PendingDraw, { type: 'freehand' }>['variant']>;
const FREEHAND_VARIANTS: Record<FreehandVariant, true> = {
  highlighter: true,
  'shape-pen': true,
};

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
  // Plain pen plus every variant.
  freehand: [
    { type: 'freehand' },
    ...(Object.keys(FREEHAND_VARIANTS) as FreehandVariant[]).map((variant): PendingDraw => ({
      type: 'freehand',
      variant,
    })),
  ],
};

const ALL_INTENTS: PendingDraw[] = Object.values(INTENT_SAMPLES).flat();

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
    expect(drawBannerMessage({ type: 'table' }, false)).toBe('Tap to drop or drag to draw a table');
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

  it('spells out a hyphenated kind instead of leaving the hyphen in', () => {
    // 'Mode-button' / 'Code-block' is the capitalise-the-first-letter fallback
    // showing through; these are two-word names.
    expect(drawBannerMessage({ type: 'shape', kind: 'mode-button' }, false)).toBe(
      'Tap to drop or drag to draw Mode button',
    );
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

  it('keeps freehand gestural-only, with the close hint only on desktop', () => {
    // The pencil collects a pointer stream (no tap-to-drop), so it keeps
    // "Drag to draw"; the release-near-start hint overflows the mobile
    // banner so phones get the bare copy.
    expect(drawBannerMessage({ type: 'freehand' }, false)).toBe(
      'Drag to draw (release near the start to close)',
    );
    expect(drawBannerMessage({ type: 'freehand' }, true)).toBe('Drag to draw');
  });

  it('has the shape pen announce that it converts, shortened on mobile', () => {
    // Recognition used to be a hidden toggle; it is now which pen you picked
    // (spec/115), so the banner is where that gets said. Distinct from plain
    // freehand on both viewports, or the two pens would read identically.
    expect(drawBannerMessage({ type: 'freehand', variant: 'shape-pen' }, false)).toBe(
      'Draw a rough shape — it snaps to the real one',
    );
    expect(drawBannerMessage({ type: 'freehand', variant: 'shape-pen' }, true)).toBe(
      'Draw a shape',
    );
    expect(drawBannerMessage({ type: 'freehand', variant: 'shape-pen' }, false)).not.toBe(
      drawBannerMessage({ type: 'freehand' }, false),
    );
  });

  it('gives the highlighter variant its own copy with no close hint', () => {
    // The highlighter never closes / fills (spec/81), so both viewports
    // get the same short copy.
    expect(drawBannerMessage({ type: 'freehand', variant: 'highlighter' }, false)).toBe(
      'Drag to highlight',
    );
    expect(drawBannerMessage({ type: 'freehand', variant: 'highlighter' }, true)).toBe(
      'Drag to highlight',
    );
  });

  it('describes the polygon click-to-place gesture, shortened on mobile', () => {
    expect(drawBannerMessage({ type: 'polygon' }, false)).toBe(
      'Click to place points — click the start to close, double-click to finish',
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

  it('gives every component kind the stacked-blocks glyph cursor', () => {
    // One cursor for the whole category (matching the Components palette
    // tile), so the kind doesn't change it.
    for (const kind of ['banner', 'hero', 'avatar'] as const) {
      expect(isInlineSvgCursor(drawIntentCursor({ type: 'component', kind }))).toBe(true);
    }
  });

  it('gives each pen variant its own cursor', () => {
    // Three pens share the freehand intent and each has its own glyph — the
    // highlighter's marker, the shape pen's nib-plus-dashed-square, and the
    // plain nib. If any two collided, the cursor would stop telling you
    // which pen is armed, which is the one thing it is there to do.
    const cursors = [
      drawIntentCursor({ type: 'freehand' }),
      drawIntentCursor({ type: 'freehand', variant: 'highlighter' }),
      drawIntentCursor({ type: 'freehand', variant: 'shape-pen' }),
    ];
    for (const c of cursors) expect(isInlineSvgCursor(c)).toBe(true);
    expect(new Set(cursors).size).toBe(3);
  });

  it('never returns an empty or inherited ("auto") cursor', () => {
    for (const intent of [...ALL_INTENTS, { type: 'shape', kind: 'cloud' } as PendingDraw]) {
      const c = drawIntentCursor(intent);
      expect(c).toBeTruthy();
      expect(c).not.toBe('auto');
    }
  });
});
