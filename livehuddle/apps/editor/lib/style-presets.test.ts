import {
  ARROW_THICKNESS_PX,
  DEFAULT_ANIMATION_SPEED,
  encodeStrokePoints,
  freehandPressures,
  type Element,
  type FreehandElement,
} from '@livehuddle/document';
import { describe, expect, it } from 'vitest';
import type { ShapeColorPreset } from './themes';
import {
  applyArrowPresetToEl,
  applyBorderRadiusToEl,
  applyBorderStrokeToEl,
  applyBorderStyleToEl,
  applyColorPresetToEl,
  applyLabelFillToEl,
  applyFillColorToEl,
  applyIconWeightToEl,
  applyRotationToEl,
  applyShadowToEl,
  applyFinishToEl,
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

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine": a stored table is a placeholder, so no
// style control changes what it saved.
describe('a stored table', () => {
  const table = () => el('table', { tablePreset: 'table-banded', strokeColor: '#123456' });

  it('keeps every colour, border and finish it stored', () => {
    for (const apply of [
      (t: Element) => applyFillColorToEl(t, '#c'),
      (t: Element) => applyStrokeColorToEl(t, '#c'),
      (t: Element) => applyTextColorToEl(t, '#c'),
      (t: Element) => applyBorderStrokeToEl(t, 'thick'),
      (t: Element) => applyBorderStyleToEl(t, 'dotted'),
      (t: Element) => applyFinishToEl(t, 'sketch'),
    ]) {
      const source = table();
      expect(apply(source)).toBe(source);
    }
  });
});

describe('colour field setters clear the colour-preset binding on shapes', () => {
  it('applyFillColorToEl: shape clears colorPreset; sticky/freehand keep theirs; others no-op', () => {
    expect(applyFillColorToEl(el('shape', { colorPreset: 'x' }), '#c')).toMatchObject({
      fillColor: '#c',
      colorPreset: undefined,
    });
    expect(applyFillColorToEl(el('sticky'), '#c')).toMatchObject({ fillColor: '#c' });
    expect(applyFillColorToEl(el('freehand'), '#c')).toMatchObject({ fillColor: '#c' });
    const text = el('text');
    expect(applyFillColorToEl(text, '#c')).toBe(text); // text has no fill
  });

  it('applyStrokeColorToEl: applies to shape/sticky/arrow/freehand', () => {
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
  it('stroke/style apply to shapes and freehand only', () => {
    expect(applyBorderStrokeToEl(el('shape'), 'thick')).toMatchObject({ strokeWidth: 'thick' });
    expect(applyBorderStrokeToEl(el('freehand'), 'thin')).toMatchObject({ strokeWidth: 'thin' });
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

  // docs/specs/009-elements/blueprints/annotations.md [QD8]: a marker never rotates, even inside a
  // multi-selection's Rotation pick.
  it('is a no-op on an annotation marker', () => {
    const marker = el('annotation');
    expect(applyRotationToEl(marker, 90)).toBe(marker);
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

// docs/specs/007-editor/editor-modes.md "One look": the element menu's Ink swatch stores Ink by
// name; any other colour replaces a stored name.
describe('Ink by name from the colour rows', () => {
  it('stores Ink as the line\u2019s name on a shape, an arrow and a pen stroke', () => {
    for (const type of ['shape', 'arrow', 'freehand']) {
      const out = applyStrokeColorToEl(el(type, { strokeColor: '#ff0000' }), 'ink') as {
        strokeColor?: string;
        penColour?: string;
      };
      expect(out.penColour, type).toBe('ink');
      expect(out.strokeColor, type).toBeUndefined();
    }
  });

  it('stores Ink as the text\u2019s name on a shape, a text box, a note and an arrow label', () => {
    for (const type of ['shape', 'text', 'sticky', 'arrow']) {
      const out = applyTextColorToEl(el(type, { textColor: '#ff0000' }), 'ink') as {
        textColor?: string;
        penTextColour?: string;
      };
      expect(out.penTextColour, type).toBe('ink');
      expect(out.textColor, type).toBeUndefined();
    }
  });

  it('lets a picked colour replace a stored name', () => {
    const line = applyStrokeColorToEl(el('shape', { penColour: 'ink' }), '#00ff00') as {
      penColour?: string;
      strokeColor?: string;
    };
    expect(line.penColour).toBeUndefined();
    expect(line.strokeColor).toBe('#00ff00');
    const text = applyTextColorToEl(el('text', { penTextColour: 'blue' }), '#00ff00') as {
      penTextColour?: string;
    };
    expect(text.penTextColour).toBeUndefined();
  });
});

describe('Ink where no name can be stored', () => {
  it('leaves a note border as it is', () => {
    const note = el('sticky', { strokeColor: '#123456' });
    expect(applyStrokeColorToEl(note, 'ink')).toBe(note);
  });
});

describe('applyFinishToEl (docs/specs/008-canvas/finish.md)', () => {
  it('sets a finish on shapes, arrows, text and stickies', () => {
    for (const type of ['shape', 'arrow', 'text', 'sticky']) {
      const out = applyFinishToEl(el(type), 'sketch') as { finish?: unknown };
      expect(out.finish, type).toBe('sketch');
    }
  });

  it('stores Flexible when picked, so it beats a Sketch tab', () => {
    expect((applyFinishToEl(el('shape'), 'flexible') as { finish?: unknown }).finish).toBe(
      'flexible',
    );
  });

  it('Follow Tab (null) removes the key rather than storing a value', () => {
    const out = applyFinishToEl(el('shape', { finish: 'sketch' }), null);
    expect('finish' in out).toBe(false);
    const bare = el('shape');
    expect(applyFinishToEl(bare, null)).toBe(bare);
  });

  it('no-ops (same reference) on types without a finish', () => {
    for (const type of ['freehand', 'image', 'annotation']) {
      const source = el(type);
      expect(applyFinishToEl(source, 'sketch'), type).toBe(source);
    }
  });
});
