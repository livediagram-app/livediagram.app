import type { BoxedElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { describeVariant } from '@/components/canvas/element-variant';

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

  it('a sticky has a real border + fill', () => {
    const { className, style } = describeVariant(
      make('sticky', { fillColor: '#ffd' }),
      false,
      false,
      null,
    );
    expect(className).toContain('border');
    expect(style.backgroundColor).toBe('#ffd');
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

describe('describeVariant — element shadows (spec/86)', () => {
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

  it('unsupported types ignore a stray shadow field (spec/86 gate)', () => {
    const { style } = describeVariant(make('text', { shadow }), false, false, null);
    expect(style.boxShadow).toBeUndefined();
    expect(style.filter).toBeUndefined();
  });
});
