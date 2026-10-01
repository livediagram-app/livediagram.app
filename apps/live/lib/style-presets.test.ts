import {
  ARROW_THICKNESS_PX,
  DEFAULT_ANIMATION_SPEED,
  encodeStrokePoints,
  freehandPressures,
  type Element,
  type FreehandElement,
} from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import type { ShapeColorPreset } from './themes';
import {
  applyArrowPresetToEl,
  applyBorderRadiusToEl,
  applyBorderStrokeToEl,
  applyBorderStyleToEl,
  applyChartPaletteToEl,
  applyCodeThemeToEl,
  applyColorPresetToEl,
  applyLabelFillToEl,
  applyTablePresetToEl,
  applyFillColorToEl,
  applyHeaderFillToEl,
  applyIconWeightToEl,
  applyRotationToEl,
  applyShadowToEl,
  applyStrokeColorToEl,
  applyTextColorToEl,
} from './style-presets';

// Minimal element of any type. Cast through unknown since the union
// requires per-type fields the transforms don't read.
const el = (type: string, over: Record<string, unknown> = {}): Element =>
  ({
    id: 'e',
    type,
    ...(type === 'shape' ? { shape: 'square' } : {}),
    ...(type === 'freehand' ? { packedPoints: 'AQA=' } : {}),
    ...over,
  }) as unknown as Element;

describe('applyColorPresetToEl', () => {
  const p = {
    id: 'cp',
    fill: '#fill',
    stroke: '#stroke',
    text: '#text',
    borderStroke: 'thick',
    borderStyle: 'dashed',
  } as ShapeColorPreset;

  it('stamps colours + the matching border + the preset id onto a shape', () => {
    expect(applyColorPresetToEl(el('shape'), p)).toMatchObject({
      fillColor: '#fill',
      strokeColor: '#stroke',
      textColor: '#text',
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      colorPreset: 'cp',
    });
    // Radius is the user's own silhouette choice: never stamped by a preset.
    expect(applyColorPresetToEl(el('shape'), p)).not.toHaveProperty('borderRadius', 'lg');
  });

  it('gives a sticky the paper and the ink, and no border', () => {
    // A note's edge against its peel shadow IS its border: stamping the
    // preset's stroke would draw a hairline box around the paper, so the
    // sticky branch takes two of the five fields and clears any hand-set
    // border with them.
    const applied = applyColorPresetToEl(el('sticky', { strokeColor: '#old' }), p);
    expect(applied).toMatchObject({ fillColor: '#fill', textColor: '#text' });
    expect(applied).toHaveProperty('strokeColor', undefined);
    expect(applied).not.toHaveProperty('strokeWidth');
  });

  it('is a no-op on the types with no preset grid', () => {
    const text = el('text');
    expect(applyColorPresetToEl(text, p)).toBe(text);
  });
});

describe('applyLabelFillToEl', () => {
  it('sets the caption plate on an arrow', () => {
    expect(applyLabelFillToEl(el('arrow'), '#fff')).toMatchObject({ labelFill: '#fff' });
  });

  it('is a no-op on anything else, so a mixed selection only paints arrows', () => {
    const shape = el('shape');
    expect(applyLabelFillToEl(shape, '#fff')).toBe(shape);
  });
});

describe('applyTablePresetToEl', () => {
  const p = {
    id: 'table-x',
    name: 'X',
    fill: '#fill',
    stroke: '#stroke',
    text: '#text',
    headerFill: '#head',
    headerText: '#headtext',
    zebra: true,
  };

  it('stamps all four surfaces and the banding in one go', () => {
    expect(applyTablePresetToEl(el('table'), p)).toMatchObject({
      fillColor: '#fill',
      strokeColor: '#stroke',
      textColor: '#text',
      headerFill: '#head',
      headerTextColor: '#headtext',
      zebra: true,
    });
  });

  it('records the look so a theme change can re-derive it', () => {
    expect(applyTablePresetToEl(el('table'), p)).toMatchObject({ tablePreset: 'table-x' });
  });

  it('leaves headerRow / headerColumn alone, which are data not a look', () => {
    const applied = applyTablePresetToEl(el('table', { headerRow: true, headerColumn: false }), p);
    expect(applied).toMatchObject({ headerRow: true, headerColumn: false });
  });

  it('is a no-op on anything that is not a table', () => {
    const shape = el('shape');
    expect(applyTablePresetToEl(shape, p)).toBe(shape);
  });
});

describe('applyChartPaletteToEl', () => {
  it('sets the palette on a chart without touching its data', () => {
    const chart = el('shape', { shape: 'pie-chart', pieSlices: [{ label: 'A', value: 1 }] });
    const applied = applyChartPaletteToEl(chart, 'ocean');
    expect(applied).toMatchObject({ chartPalette: 'ocean' });
    // The ramp is resolved at render, so a slice the user coloured on purpose
    // is never rewritten.
    expect(applied).toMatchObject({ pieSlices: [{ label: 'A', value: 1 }] });
  });

  it('is a no-op on a shape that is not a chart', () => {
    const square = el('shape', { shape: 'square' });
    expect(applyChartPaletteToEl(square, 'ocean')).toBe(square);
  });
});

describe('applyCodeThemeToEl', () => {
  it('sets the scheme on a code block and nothing else', () => {
    const block = el('shape', { shape: 'code-block' });
    expect(applyCodeThemeToEl(block, 'paper')).toMatchObject({ codeTheme: 'paper' });
  });

  it('is a no-op on any other shape', () => {
    const square = el('shape', { shape: 'square' });
    expect(applyCodeThemeToEl(square, 'paper')).toBe(square);
  });
});

describe("colour field setters clear a table's preset binding", () => {
  // Same rule as a shape's colorPreset: past a hand-picked colour, the look is
  // no longer the preset's, so a theme change must preserve what was chosen
  // rather than repainting the whole table.
  const bound = () => el('table', { tablePreset: 'table-banded' });

  it('applyFillColorToEl', () => {
    expect(applyFillColorToEl(bound(), '#c')).toMatchObject({
      fillColor: '#c',
      tablePreset: undefined,
    });
  });

  it('applyStrokeColorToEl', () => {
    expect(applyStrokeColorToEl(bound(), '#c')).toMatchObject({
      strokeColor: '#c',
      tablePreset: undefined,
    });
  });

  it('applyTextColorToEl', () => {
    expect(applyTextColorToEl(bound(), '#c')).toMatchObject({
      textColor: '#c',
      tablePreset: undefined,
    });
  });

  it('applyHeaderFillToEl, and leaves a lane gutter untouched', () => {
    expect(applyHeaderFillToEl(bound(), '#c')).toMatchObject({
      headerFill: '#c',
      tablePreset: undefined,
    });
    expect(applyHeaderFillToEl(el('shape', { shape: 'lane' }), '#c')).toMatchObject({
      headerFill: '#c',
    });
  });
});

describe('colour field setters clear the colour-preset binding on shapes', () => {
  it('applyFillColorToEl: shape clears colorPreset; sticky/freehand/table keep theirs; others no-op', () => {
    expect(applyFillColorToEl(el('shape', { colorPreset: 'x' }), '#c')).toMatchObject({
      fillColor: '#c',
      colorPreset: undefined,
    });
    expect(applyFillColorToEl(el('sticky'), '#c')).toMatchObject({ fillColor: '#c' });
    expect(applyFillColorToEl(el('freehand'), '#c')).toMatchObject({ fillColor: '#c' });
    const text = el('text');
    expect(applyFillColorToEl(text, '#c')).toBe(text); // text has no fill
  });

  it('applyStrokeColorToEl: applies to shape/sticky/arrow/freehand/table', () => {
    expect(applyStrokeColorToEl(el('shape', { colorPreset: 'x' }), '#c')).toMatchObject({
      strokeColor: '#c',
      colorPreset: undefined,
    });
    expect(applyStrokeColorToEl(el('arrow'), '#c')).toMatchObject({ strokeColor: '#c' });
    const text = el('text');
    expect(applyStrokeColorToEl(text, '#c')).toBe(text);
  });

  it('applyTextColorToEl: applies to any boxed element + arrows', () => {
    expect(applyTextColorToEl(el('shape', { colorPreset: 'x' }), '#c')).toMatchObject({
      textColor: '#c',
      colorPreset: undefined,
    });
    expect(applyTextColorToEl(el('text'), '#c')).toMatchObject({ textColor: '#c' });
    expect(applyTextColorToEl(el('arrow'), '#c')).toMatchObject({ textColor: '#c' });
  });
});

describe('border field setters', () => {
  it('stroke/style apply to shapes, freehand, and tables only', () => {
    expect(applyBorderStrokeToEl(el('shape'), 'thick')).toMatchObject({ strokeWidth: 'thick' });
    expect(applyBorderStrokeToEl(el('freehand'), 'thin')).toMatchObject({ strokeWidth: 'thin' });
    expect(applyBorderStrokeToEl(el('table'), 'medium')).toMatchObject({ strokeWidth: 'medium' });
    const sticky = el('sticky');
    expect(applyBorderStrokeToEl(sticky, 'thin')).toBe(sticky);
    expect(applyBorderStyleToEl(el('shape'), 'dotted')).toMatchObject({ strokeStyle: 'dotted' });
  });

  it('lets a border width replace the pen width a stroke recorded', () => {
    const pen = applyBorderStrokeToEl(el('freehand', { penWidth: 8 }), 'thin');
    expect(pen).toMatchObject({ strokeWidth: 'thin' });
    expect('penWidth' in pen).toBe(false);
  });

  it('drops a pen stroke\u2019s pressures and streamline with its pen width', () => {
    const points = [
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ];
    const pen = applyBorderStrokeToEl(
      el('freehand', {
        penWidth: 2.5,
        packedPoints: encodeStrokePoints(points, [0.2, 0.9]),
        streamline: 0.2,
      }),
      'thin',
    ) as FreehandElement;
    // The same points, re-packed without their pressures.
    expect(pen.packedPoints).toBe(encodeStrokePoints(points));
    expect(freehandPressures(pen)).toBeUndefined();
    expect('streamline' in pen).toBe(false);
  });

  it('keeps the width of a highlighter stroke, which the preset never drew', () => {
    const marker = applyBorderStrokeToEl(
      el('freehand', { pen: 'highlighter', penWidth: 20 }),
      'thin',
    );
    expect(marker).toMatchObject({ penWidth: 20 });
  });

  it('radius is shape-only', () => {
    expect(applyBorderRadiusToEl(el('shape'), 'full')).toMatchObject({ borderRadius: 'full' });
    const fh = el('freehand');
    expect(applyBorderRadiusToEl(fh, 'md')).toBe(fh);
  });
});

describe('applyRotationToEl', () => {
  it('normalises degrees to 0..359, storing 0 as undefined', () => {
    expect(applyRotationToEl(el('shape'), 90)).toMatchObject({ rotation: 90 });
    expect((applyRotationToEl(el('shape'), 360) as { rotation?: number }).rotation).toBeUndefined();
    expect(applyRotationToEl(el('shape'), -90)).toMatchObject({ rotation: 270 });
    expect(applyRotationToEl(el('shape'), 450)).toMatchObject({ rotation: 90 });
    expect(applyRotationToEl(el('shape'), 90.4)).toMatchObject({ rotation: 90 }); // rounds
  });

  it('is a no-op on non-boxed elements (arrows)', () => {
    const a = el('arrow');
    expect(applyRotationToEl(a, 45)).toBe(a);
  });
});

describe('applyArrowPresetToEl', () => {
  it('sets style/thickness, defaults flowSpeed to the shared default when a flow is added', () => {
    const out = applyArrowPresetToEl(el('arrow'), {
      style: 'dashed',
      thickness: 'medium',
      flow: 'dashes',
    });
    expect(out).toMatchObject({
      strokeStyle: 'dashed',
      strokeWidth: ARROW_THICKNESS_PX['medium'],
      flow: 'dashes',
      flowSpeed: DEFAULT_ANIMATION_SPEED,
    });
  });

  it('keeps an existing flowSpeed when a flow is re-applied', () => {
    const out = applyArrowPresetToEl(el('arrow', { flowSpeed: 'fast' }), {
      style: 'solid',
      thickness: 'thin',
      flow: 'dashes',
    });
    expect((out as { flowSpeed?: string }).flowSpeed).toBe('fast');
  });

  it('clears the flow when the preset has none', () => {
    const out = applyArrowPresetToEl(el('arrow', { flow: 'dashes' }), {
      style: 'solid',
      thickness: 'thin',
    });
    expect((out as { flow?: string }).flow).toBeUndefined();
  });

  it('is a no-op on non-arrows', () => {
    const s = el('shape');
    expect(applyArrowPresetToEl(s, { style: 'solid', thickness: 'thin' })).toBe(s);
  });
});

describe('applyShadowToEl', () => {
  const shadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };

  it('sets a clamped shadow on the body-drawing boxed types (docs/specs/008-canvas/element-shadows.md)', () => {
    for (const type of ['shape', 'sticky', 'image', 'link-card']) {
      const out = applyShadowToEl(el(type), shadow) as { shadow?: unknown };
      expect(out.shadow, type).toEqual(shadow);
    }
    const wild = applyShadowToEl(el('shape'), { ...shadow, blur: 999 }) as {
      shadow?: { blur: number };
    };
    expect(wild.shadow?.blur).toBe(48);
  });

  it('null clears the field (the None tile)', () => {
    const out = applyShadowToEl(el('shape', { shadow }), null) as { shadow?: unknown };
    expect(out.shadow).toBeUndefined();
  });

  it('no-ops (same reference) on unsupported types', () => {
    for (const type of ['text', 'freehand', 'annotation', 'table', 'arrow']) {
      const source = el(type);
      expect(applyShadowToEl(source, shadow), type).toBe(source);
    }
  });
});

describe('any other colour edit drops a quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md)', () => {
  const bound = el('shape', { strokeSwatch: 2, fillSwatch: 4 });

  it('a hand-set background drops the background binding only', () => {
    const next = applyFillColorToEl(bound, '#abcdef');
    expect(next).toMatchObject({ fillColor: '#abcdef', fillSwatch: undefined, strokeSwatch: 2 });
  });

  it('a hand-set stroke drops the stroke binding, on shapes and arrows', () => {
    expect(applyStrokeColorToEl(bound, '#abcdef')).toMatchObject({
      strokeSwatch: undefined,
      fillSwatch: 4,
    });
    expect(applyStrokeColorToEl(el('arrow', { strokeSwatch: 1 }), '#abcdef')).toHaveProperty(
      'strokeSwatch',
      undefined,
    );
  });

  it('a preset drops both', () => {
    const next = applyColorPresetToEl(bound, {
      id: 'cp',
      fill: '#f',
      stroke: '#s',
      text: '#t',
      borderStroke: 'thin',
      borderStyle: 'solid',
    } as ShapeColorPreset);
    expect(next).toMatchObject({ strokeSwatch: undefined, fillSwatch: undefined });
  });
});

describe('applyIconWeightToEl', () => {
  it('sets the weight on a line-art icon', () => {
    const icon = el('shape', { shape: 'icon', iconId: 'server' });
    expect(applyIconWeightToEl(icon, 'bold')).toMatchObject({ iconWeight: 'bold' });
  });

  it('leaves Technology marks and other elements untouched', () => {
    const tech = el('shape', { shape: 'icon', iconId: 'aws-s3' });
    expect(applyIconWeightToEl(tech, 'bold')).toBe(tech);
    const square = el('shape');
    expect(applyIconWeightToEl(square, 'thin')).toBe(square);
  });
});
