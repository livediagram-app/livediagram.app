import { ARROW_THICKNESS_PX, DEFAULT_ANIMATION_SPEED, type Element } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import type { ShapeColorPreset } from './themes';
import {
  applyArrowPresetToEl,
  applyBorderRadiusToEl,
  applyBorderStrokeToEl,
  applyBorderStyleToEl,
  applyColorPresetToEl,
  applyFillColorToEl,
  applyRotationToEl,
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

  it('is a no-op on non-shapes', () => {
    const sticky = el('sticky');
    expect(applyColorPresetToEl(sticky, p)).toBe(sticky);
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
