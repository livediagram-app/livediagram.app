import { describe, expect, it } from 'vitest';
import {
  EXCALIDRAW_FREEDRAW_WIDTH_FACTOR,
  fillOf,
  fontFamilyOf,
  headOf,
  opacityFactor,
  readColour,
  sceneTextOf,
  strokeOf,
} from './excalidraw-scene-style';
import { EXCALIDRAW_NOTE, SceneNotes } from './excalidraw-scene-notes';
import { excalidrawBuilder } from './excalidraw-fixtures';

describe('readColour', () => {
  it.each([
    ['#1e1e1e', { hex: '#1e1e1e' }],
    ['#1971C2', { hex: '#1971c2' }],
    ['#abc', { hex: '#aabbcc' }],
    ['#ff000080', { hex: '#ff0000', alpha: 128 / 255 }],
    ['#ff0000ff', { hex: '#ff0000' }],
  ])('reads %s', (value, colour) => {
    expect(readColour(value)).toEqual({ kind: 'colour', colour });
  });

  it('reads transparent as no colour', () => {
    expect(readColour('transparent')).toEqual({ kind: 'none' });
  });

  it.each(['red', 'rgb(0,0,0)', '#12', '#gggggg', '', 3, null, undefined])(
    'calls %s unreadable',
    (value) => {
      expect(readColour(value)).toEqual({ kind: 'unreadable' });
    },
  );
});

describe('opacityFactor', () => {
  it.each([
    [100, 1],
    [undefined, 1],
    [50, 0.5],
    [0, 0],
    [150, 1],
    [-5, 0],
    [Number.NaN, 1],
  ])('maps %s to %s', (o, f) => {
    expect(opacityFactor(o)).toBe(f);
  });
});

describe('strokeOf', () => {
  const b = excalidrawBuilder();

  it('keeps colour, width and dash; full opacity omitted', () => {
    const notes = new SceneNotes();
    expect(
      strokeOf(
        b.rectangle({ strokeColor: '#1971c2', strokeWidth: 4, strokeStyle: 'dashed' }),
        notes,
      ),
    ).toEqual({
      colour: { hex: '#1971c2' },
      widthPx: 4,
      dash: 'dashed',
    });
    expect(strokeOf(b.rectangle({ strokeStyle: 'dotted' }), notes)?.dash).toBe('dotted');
    expect(strokeOf(b.rectangle({ strokeStyle: 'solid' }), notes)?.dash).toBeUndefined();
  });

  it('carries element opacity and colour alpha together', () => {
    const s = strokeOf(
      b.line(
        [
          [0, 0],
          [1, 1],
        ],
        { opacity: 50, strokeColor: '#ff000080' },
      ),
      new SceneNotes(),
    );
    expect(s?.opacity).toBeCloseTo(0.5);
    expect(s?.colour).toEqual({ hex: '#ff0000', alpha: 128 / 255 });
  });

  it('is null for a transparent stroke', () => {
    expect(strokeOf(b.rectangle({ strokeColor: 'transparent' }), new SceneNotes())).toBeNull();
  });

  it('falls back to ink with a note for an unreadable colour', () => {
    const notes = new SceneNotes();
    expect(strokeOf(b.rectangle({ strokeColor: 'red' }), notes)?.colour).toBe('ink');
    expect(notes.list()).toEqual([{ rule: EXCALIDRAW_NOTE.unreadableColour, count: 1 }]);
  });

  it('defaults a missing width to Excalidraw 2 px', () => {
    expect(strokeOf(b.rectangle({ strokeWidth: undefined }), new SceneNotes())?.widthPx).toBe(2);
  });

  it('reports freedraw at the width Excalidraw paints', () => {
    const constant = b.freedraw(
      [
        [0, 0],
        [5, 5],
      ],
      { strokeWidth: 2 },
    );
    const variable = b.freedraw(
      [
        [0, 0],
        [5, 5],
      ],
      {
        strokeWidth: 2,
        strokeOptions: { variability: 'variable', streamline: 0.5 },
      },
    );
    const legacy = b.freedraw(
      [
        [0, 0],
        [5, 5],
      ],
      { strokeWidth: 1, strokeOptions: undefined },
    );
    const n = new SceneNotes();
    expect(strokeOf(constant, n)?.widthPx).toBeCloseTo(
      2 * EXCALIDRAW_FREEDRAW_WIDTH_FACTOR.constant,
    );
    expect(strokeOf(variable, n)?.widthPx).toBeCloseTo(
      2 * EXCALIDRAW_FREEDRAW_WIDTH_FACTOR.variable,
    );
    expect(strokeOf(legacy, n)?.widthPx).toBeCloseTo(EXCALIDRAW_FREEDRAW_WIDTH_FACTOR.variable);
  });
});

describe('fillOf', () => {
  const b = excalidrawBuilder();
  it('is undefined for transparent', () => {
    expect(fillOf(b.rectangle(), new SceneNotes())).toBeUndefined();
  });
  it('keeps a colour with the element opacity as alpha', () => {
    expect(fillOf(b.stickynote({ opacity: 40 }), new SceneNotes())).toEqual({
      hex: '#ffdf6b',
      alpha: 0.4,
    });
    expect(fillOf(b.stickynote(), new SceneNotes())).toEqual({ hex: '#ffdf6b' });
  });
  it('drops an unreadable fill with a note', () => {
    const notes = new SceneNotes();
    expect(fillOf(b.rectangle({ backgroundColor: 'gold' }), notes)).toBeUndefined();
    expect(notes.list()[0]?.rule).toBe(EXCALIDRAW_NOTE.unreadableColour);
  });
});

describe('fontFamilyOf', () => {
  it.each([
    [1, 'hand'],
    [5, 'hand'],
    [3, 'mono'],
    [8, 'mono'],
    [2, 'sans'],
    [6, 'sans'],
    [7, 'sans'],
    [9, 'sans'],
    [undefined, 'sans'],
  ])('maps family %s to %s', (family, mapped) => {
    expect(fontFamilyOf(family)).toBe(mapped);
  });
});

describe('sceneTextOf', () => {
  const b = excalidrawBuilder();
  it('keeps the unwrapped text, exact size, family, colour and alignment', () => {
    const t = b.text('wrapped\nline', {
      originalText: 'wrapped line',
      fontSize: 13.08,
      strokeColor: '#2f9e44',
      textAlign: 'right',
      verticalAlign: 'bottom',
    });
    expect(sceneTextOf(t, new SceneNotes())).toEqual({
      text: 'wrapped line',
      fontPx: 13.08,
      family: 'hand',
      colour: { hex: '#2f9e44' },
      alignX: 'right',
      alignY: 'bottom',
    });
  });

  it('falls back to text, 20 px and ink; skips unknown alignments', () => {
    const t = b.text('hi', {
      originalText: undefined,
      fontSize: undefined,
      strokeColor: 'nope',
      textAlign: 'justify',
      verticalAlign: 'sideways',
    });
    expect(sceneTextOf(t, new SceneNotes())).toEqual({
      text: 'hi',
      fontPx: 20,
      family: 'hand',
      colour: 'ink',
    });
  });

  it('applies element opacity as colour alpha', () => {
    const t = b.text('hi', { opacity: 25 });
    expect(sceneTextOf(t, new SceneNotes()).colour).toEqual({ hex: '#1e1e1e', alpha: 0.25 });
  });
});

describe('headOf', () => {
  it.each([
    ['arrow', 'arrow'],
    ['bar', 'bar'],
    ['triangle', 'triangle'],
    ['triangle_outline', 'triangle-hollow'],
    ['dot', 'circle'],
    ['circle', 'circle'],
    ['circle_outline', 'circle-hollow'],
    ['diamond', 'diamond'],
    ['diamond_outline', 'diamond-hollow'],
  ])('maps %s to %s', (value, head) => {
    const notes = new SceneNotes();
    expect(headOf(value, notes)).toBe(head);
    expect(notes.list()).toEqual([]);
  });

  it.each(['crowfoot_one', 'crowfoot_many', 'crowfoot_one_or_many', 'spiral'])(
    'draws %s as an arrow with a note',
    (value) => {
      const notes = new SceneNotes();
      expect(headOf(value, notes)).toBe('arrow');
      expect(notes.list()).toEqual([{ rule: EXCALIDRAW_NOTE.unmatchedHeads, count: 1 }]);
    },
  );

  it('has no head for null or absent values', () => {
    expect(headOf(null, new SceneNotes())).toBeUndefined();
    expect(headOf(undefined, new SceneNotes())).toBeUndefined();
  });
});
