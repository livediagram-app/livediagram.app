import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement } from '@livediagram/diagram';
import { summarizeChange, summarizeEdits } from './change-summaries';

// The activity panel's one-line vocabulary (spec/12): each field group
// gets a verb a user recognises, so entries never degrade to a vague
// "Edited X" when the change is nameable.

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

const arrow = (id: string, overrides: Partial<ArrowElement> = {}): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 0 },
  ...overrides,
});

const edit = (before: Element, after: Element) => summarizeEdits([{ before, after }]);

describe('summarizeEdits — single element verbs', () => {
  it('names a move, resize, and rotation', () => {
    expect(edit(shape('a'), shape('a', { x: 40, y: 10 }))).toBe('Moved a Square');
    expect(edit(shape('a'), shape('a', { width: 200 }))).toBe('Resized a Square');
    expect(edit(shape('a'), shape('a', { rotation: 45 }))).toBe('Rotated a Square');
  });

  it('prefers the quoted label as the subject', () => {
    expect(edit(shape('a', { label: 'API' }), shape('a', { label: 'API', x: 9 }))).toBe(
      "Moved 'API'",
    );
  });

  it('label changes: labelled / renamed / cleared', () => {
    expect(edit(shape('a'), shape('a', { label: 'Login' }))).toBe("Labelled a Square 'Login'");
    expect(edit(shape('a', { label: 'Login' }), shape('a', { label: 'Sign in' }))).toBe(
      "Renamed 'Login' to 'Sign in'",
    );
    expect(edit(shape('a', { label: 'Login' }), shape('a', { label: '' }))).toBe(
      'Cleared the label on a Square',
    );
  });

  it('colour and opacity changes', () => {
    expect(edit(shape('a'), shape('a', { fillColor: '#f00' }))).toBe('Recoloured a Square');
    expect(edit(shape('a'), shape('a', { opacity: 0.4 }))).toBe(
      'Set the opacity of a Square to 40%',
    );
  });

  it('lock, link, and layer changes', () => {
    expect(edit(shape('a'), shape('a', { locked: true }))).toBe('Locked a Square');
    expect(edit(shape('a', { locked: true }), shape('a'))).toBe('Unlocked a Square');
    expect(edit(shape('a'), shape('a', { link: { kind: 'url', url: 'https://x.y' } }))).toBe(
      'Added a link to a Square',
    );
    expect(edit(shape('a', { link: { kind: 'url', url: 'https://x.y' } }), shape('a'))).toBe(
      'Removed the link from a Square',
    );
    expect(edit(shape('a'), shape('a', { layerId: 'l2' }))).toBe('Moved a Square to another layer');
  });

  it('text styling groups into one verb', () => {
    expect(edit(shape('a'), shape('a', { textBold: true, textSize: 'lg' }))).toBe(
      'Restyled the text on a Square',
    );
  });

  it('border changes on a box', () => {
    expect(edit(shape('a'), shape('a', { strokeWidth: 'thick', strokeStyle: 'dashed' }))).toBe(
      'Changed the border of a Square',
    );
  });

  it('animation and shape-kind changes', () => {
    expect(edit(shape('a'), shape('a', { animation: 'pulse' }))).toBe(
      'Changed the animation on a Square',
    );
    expect(edit(shape('a'), shape('a', { shape: 'circle' }))).toBe('Changed a Square to a Circle');
  });

  it('a colour-preset apply names the preset', () => {
    // applyColorPresetToEl stamps colours + border + the preset id in one move.
    const styled = shape('a', {
      fillColor: '#e0f2fe',
      strokeColor: '#0284c7',
      textColor: '#0c4a6e',
      strokeWidth: 'thick',
      strokeStyle: 'solid',
      borderRadius: 'md',
      colorPreset: 'bold',
    });
    expect(edit(shape('a'), styled)).toBe('Applied the Bold style to a Square');
    expect(edit(shape('a'), { ...styled, colorPreset: 'branch-2' })).toBe(
      'Applied a colour preset to a Square',
    );
  });

  it('hand-editing a colour (which clears the preset binding) stays a recolour', () => {
    const before = shape('a', { fillColor: '#fff', colorPreset: 'bold' });
    const after = shape('a', { fillColor: '#f00', colorPreset: undefined });
    expect(edit(before, after)).toBe('Recoloured a Square');
  });

  it('hyphenated shape kinds read as prose', () => {
    expect(edit(shape('a', { shape: 'pie-chart' }), shape('a', { shape: 'pie-chart', x: 5 }))).toBe(
      'Moved a Pie chart',
    );
  });
});

describe('summarizeEdits — arrows', () => {
  it('an endpoint / curve change is a reshape, a pure translation is a move', () => {
    expect(edit(arrow('r'), arrow('r', { to: { kind: 'free', x: 150, y: 40 } }))).toBe(
      'Reshaped an Arrow',
    );
    expect(
      edit(
        arrow('r'),
        arrow('r', { from: { kind: 'free', x: 20, y: 5 }, to: { kind: 'free', x: 120, y: 5 } }),
      ),
    ).toBe('Moved an Arrow');
  });

  it('head / line style changes are a restyle', () => {
    expect(edit(arrow('r'), arrow('r', { arrowheadShape: 'diamond', strokeWidth: 3 }))).toBe(
      'Restyled an Arrow',
    );
  });

  it('a line preset (style + thickness + flow) is a restyle, a pure flow toggle is an animation change', () => {
    expect(
      edit(
        arrow('r'),
        arrow('r', { strokeStyle: 'dashed', strokeWidth: 2, flow: 'dashes', flowSpeed: 'normal' }),
      ),
    ).toBe('Restyled an Arrow');
    expect(edit(arrow('r'), arrow('r', { flow: 'dots' }))).toBe(
      'Changed the animation on an Arrow',
    );
  });
});

describe('summarizeEdits — multi-element', () => {
  it('applies the shared verb to the whole selection', () => {
    const pairs = [
      { before: shape('a'), after: shape('a', { x: 10 }) },
      { before: shape('b'), after: shape('b', { x: 10 }) },
      {
        before: arrow('r'),
        after: arrow('r', {
          from: { kind: 'free' as const, x: 10, y: 0 },
          to: { kind: 'free' as const, x: 110, y: 0 },
        }),
      },
    ];
    expect(summarizeEdits(pairs)).toBe('Moved 2 Squares & an Arrow');
  });

  it('recolours a multi-selection', () => {
    const pairs = [
      { before: shape('a'), after: shape('a', { fillColor: '#f00' }) },
      { before: shape('b'), after: shape('b', { fillColor: '#f00' }) },
    ];
    expect(summarizeEdits(pairs)).toBe('Recoloured 2 Squares');
  });

  it('falls back to Edited when the fields are unrelated', () => {
    const pairs = [
      { before: shape('a'), after: shape('a', { x: 10 }) },
      { before: shape('b'), after: shape('b', { fillColor: '#f00' }) },
    ];
    expect(summarizeEdits(pairs)).toBe('Edited 2 Squares');
  });
});

describe('summarizeChange — mixed commits', () => {
  it('a one-for-one swap reads as a replacement', () => {
    const sketch: Element = {
      id: 's',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      points: [{ nx: 0, ny: 0 }],
      closed: false,
    } as Element;
    expect(summarizeChange('edit', [shape('a')], [sketch], [])).toBe(
      'Replaced a Sketch with a Square',
    );
  });

  it('spells out each part of a mixed commit', () => {
    expect(
      summarizeChange(
        'edit',
        [shape('a')],
        [],
        [{ before: shape('b'), after: shape('b', { x: 5 }) }],
      ),
    ).toBe('Added a Square & edited a Square');
  });
});
