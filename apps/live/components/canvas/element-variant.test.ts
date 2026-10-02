import type { BoxedElement } from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import { describeVariant, editingLook } from '@/components/canvas/element-variant';

const shape = (over: Record<string, unknown> = {}): BoxedElement =>
  ({
    id: 's',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...over,
  }) as BoxedElement;
const make = (type: string, over: Record<string, unknown> = {}): BoxedElement =>
  ({ id: 'e', type, x: 0, y: 0, width: 100, height: 60, ...over }) as BoxedElement;

describe('describeVariant — selection rings', () => {
  it('a CSS shape gets the subtle ring when singly selected, none when not', () => {
    expect(describeVariant(shape(), true, false, null).className).toContain('ring-brand-200');
    expect(describeVariant(shape(), false, false, null).className).not.toContain('ring-');
  });

  it('multi-selection uses the louder offset ring regardless of type', () => {
    expect(describeVariant(shape(), false, true, null).className).toContain('ring-brand-500');
    expect(describeVariant(make('text'), false, true, null).className).toContain('ring-brand-500');
  });
});

// Dark mode (docs/specs/008-canvas/canvas-and-palette.md, Selection): a single selection is a
// blue-500/80 ring with a soft glow, so it reads as light on dark paper. Light keeps the brand ring.
describe('describeVariant — dark selection', () => {
  const DARK_RING = ['dark:ring-blue-500/80', 'dark:shadow-[0_0_20px_rgba(37,99,235,0.15)]'];

  it('adds the blue ring and glow to a single selection of every kind', () => {
    for (const el of [
      shape(),
      shape({ shape: 'diamond' }),
      make('text'),
      make('sticky'),
      make('image'),
    ]) {
      const cls = describeVariant(el, true, false, null).className.split(/\s+/);
      for (const token of DARK_RING) expect(cls, el.type).toContain(token);
    }
  });

  it('keeps the light ring exactly as it was', () => {
    expect(describeVariant(shape(), true, false, null).className).toContain(
      'ring-2 ring-brand-200',
    );
  });

  it('leaves unselected and multi-selected elements alone', () => {
    expect(describeVariant(shape(), false, false, null).className).not.toContain('dark:ring');
    expect(describeVariant(shape(), false, true, null).className).not.toContain('dark:ring');
  });
});

describe('describeVariant — per-type body styling', () => {
  it('a CSS shape carries fill + border + radius in style', () => {
    const { style } = describeVariant(
      shape({ fillColor: '#fff', strokeColor: '#000' }),
      false,
      false,
      null,
    );
    expect(style.backgroundColor).toBe('#fff');
    expect(style.borderColor).toBe('#000');
    expect(style.borderWidth).not.toBeUndefined();
  });

  it('an SVG-rendered shape carries no wrapper border/background (the overlay draws it)', () => {
    const { style } = describeVariant(shape({ shape: 'diamond' }), false, false, null);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBe('4px');
  });

  // docs/specs/008-canvas/corner-radius.md: a corner is never more than a quarter of the shorter side.
  it('rounds a small rectangle by a quarter of its side, a large one by its preset', () => {
    const small = shape({ width: 14, height: 14, borderRadius: 'lg' });
    expect(describeVariant(small, false, false, null).style.borderRadius).toBe('3.5px');
    const large = shape({ width: 200, height: 120, borderRadius: 'lg' });
    expect(describeVariant(large, false, false, null).style.borderRadius).toBe('24px');
    const unset = shape({ width: 16, height: 40 });
    expect(describeVariant(unset, false, false, null).style.borderRadius).toBe('4px');
    const pill = shape({ width: 14, height: 14, borderRadius: 'full' });
    expect(describeVariant(pill, false, false, null).style.borderRadius).toBe('9999px');
    const node = shape({ shape: 'mind-node', width: 20, height: 20 });
    expect(describeVariant(node, false, false, null).style.borderRadius).toBe('5px');
  });

  it('circle and stadium use fixed silhouette radii', () => {
    expect(describeVariant(shape({ shape: 'circle' }), false, false, null).style.borderRadius).toBe(
      '50%',
    );
    expect(
      describeVariant(shape({ shape: 'stadium' }), false, false, null).style.borderRadius,
    ).toBe('9999px');
  });

  it('a CSS-native pattern (solid/dashed/dotted) stays on the CSS border', () => {
    const { style } = describeVariant(shape({ strokeStyle: 'dashed' }), false, false, null);
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderWidth).not.toBe(0);
  });

  it('a composite pattern drops the CSS border so the SVG overlay can draw it', () => {
    for (const strokeStyle of ['dash-dot', 'long-dash', 'dash-dot-dot']) {
      const { style } = describeVariant(shape({ strokeStyle }), false, false, null);
      expect(style.borderStyle).toBe('none');
      expect(style.borderWidth).toBe(0);
    }
  });

  it('a remote selection keeps a solid CSS border even for a composite pattern', () => {
    const { style } = describeVariant(shape({ strokeStyle: 'dash-dot' }), false, false, '#ff0000');
    expect(style.borderStyle).toBe('solid');
    expect(style.borderWidth).toBe(3);
  });

  it('a sticky is borderless paper by default; an explicit stroke draws one', () => {
    // Real stickies have no outline — the sheet's edge against its shadow is
    // the border. Setting strokeColor is an explicit user choice, so it
    // still draws (the swatch stays functional, docs/specs/008-canvas/canvas-and-palette.md Colours).
    const plain = describeVariant(make('sticky', { fillColor: '#ffd' }), false, false, null);
    expect(plain.className).not.toContain('border');
    expect(plain.style.backgroundColor).toBe('#ffd');
    expect(plain.style.borderColor).toBeUndefined();
    expect(plain.style.borderWidth).toBeUndefined();
    const stroked = describeVariant(make('sticky', { strokeColor: '#b45309' }), false, false, null);
    expect(stroked.style.borderColor).toBe('#b45309');
    expect(stroked.style.borderWidth).toBe(1);
    expect(stroked.style.borderStyle).toBe('solid');
  });

  it('a sticky is square-cornered and wears the paper-peel class, not a halo', () => {
    // Paper look (docs/specs/008-canvas/canvas-and-palette.md): sharp corners (a real sticky is die-cut square),
    // and the peel is cast by the .lvd-sticky-peel pseudo-element — a shadow
    // caster inset below the glued top strip, so the shadow starts partway
    // DOWN THE SIDES and offsets increasingly toward the bottom. A wrapper
    // box-shadow can't start partway down a side, which is why no default
    // inline boxShadow (and no uniform shadow-md halo) is set here; the
    // note's own shape never changes.
    const { className, style } = describeVariant(make('sticky'), false, false, null);
    expect(style.borderRadius).toBeUndefined();
    expect(className).not.toContain('rounded');
    expect(className).not.toContain('shadow-md');
    expect(className).toContain('lvd-sticky-peel');
    expect(style.boxShadow).toBeUndefined();
  });

  it('a user-set shadow (docs/specs/008-canvas/element-shadows.md) replaces the peel outright', () => {
    const userShadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };
    const { className, style } = describeVariant(
      make('sticky', { shadow: userShadow }),
      false,
      false,
      null,
    );
    expect(className).not.toContain('lvd-sticky-peel');
    expect(style.boxShadow).toBe('0px 4px 12px rgba(15, 23, 42, 0.25)');
  });

  it('text / freehand / table carry no body border or fill', () => {
    for (const type of ['text', 'freehand', 'table']) {
      const { style } = describeVariant(make(type), false, false, null);
      expect(style.backgroundColor).toBeUndefined();
      expect(style.borderWidth).toBeUndefined();
    }
  });
});

describe('describeVariant — remote-selector signal', () => {
  it('borderless types render the remote colour as an outline halo', () => {
    for (const type of ['text', 'freehand', 'table', 'image']) {
      const { style } = describeVariant(make(type), false, false, '#ff0000');
      const hasHalo = style.outline === '3px solid #ff0000' || style.borderColor === '#ff0000';
      expect(hasHalo).toBe(true);
    }
  });

  it('a CSS shape renders the remote colour as a thick border', () => {
    const { style } = describeVariant(shape(), false, false, '#ff0000');
    expect(style.borderColor).toBe('#ff0000');
    expect(style.borderWidth).toBe(3);
  });
});

describe('describeVariant — element shadows (docs/specs/008-canvas/element-shadows.md)', () => {
  const shadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };
  const boxCss = '0px 4px 12px rgba(15, 23, 42, 0.25)';
  const filterCss = 'drop-shadow(0px 4px 12px rgba(15, 23, 42, 0.25))';

  it('an opaque CSS shape takes the box-shadow path (follows the border radius)', () => {
    const { style } = describeVariant(shape({ shadow }), false, false, null);
    expect(style.boxShadow).toBe(boxCss);
    expect(style.filter).toBeUndefined();
  });

  it('a transparent-fill shape takes the drop-shadow filter path (a box-shadow would outline nothing)', () => {
    const { style } = describeVariant(
      shape({ fillColor: 'transparent', shadow }),
      false,
      false,
      null,
    );
    expect(style.filter).toBe(filterCss);
    expect(style.boxShadow).toBeUndefined();
  });

  it('an SVG-rendered silhouette takes the filter path (shadow follows the drawn alpha)', () => {
    const { style } = describeVariant(shape({ shape: 'diamond', shadow }), false, false, null);
    expect(style.filter).toBe(filterCss);
  });

  it('sticky uses box-shadow, image uses the filter', () => {
    expect(describeVariant(make('sticky', { shadow }), false, false, null).style.boxShadow).toBe(
      boxCss,
    );
    expect(
      describeVariant(make('image', { imageId: null, shadow }), false, false, null).style.filter,
    ).toBe(filterCss);
  });

  it('no shadow field -> neither property is set (the cosmetic Tailwind classes stay in charge)', () => {
    const { style } = describeVariant(shape(), false, false, null);
    expect(style.boxShadow).toBeUndefined();
    expect(style.filter).toBeUndefined();
  });

  it('unsupported types ignore a stray shadow field (docs/specs/008-canvas/element-shadows.md gate)', () => {
    const { style } = describeVariant(make('text', { shadow }), false, false, null);
    expect(style.boxShadow).toBeUndefined();
    expect(style.filter).toBeUndefined();
  });
});

describe('editingLook (docs/specs/023-whiteboard/path-tool.md "Editing")', () => {
  it('raises a label being typed and shows the text cursor on it', () => {
    expect(editingLook({ type: 'shape' }, true)).toEqual({ raise: true, textCursor: true });
    expect(editingLook({ type: 'shape' }, false)).toEqual({ raise: false, textCursor: false });
  });

  it('never gives a path in its edit mode a text cursor, nor lifts it over its own nodes', () => {
    expect(editingLook({ type: 'path' }, true)).toEqual({ raise: false, textCursor: false });
  });
});
