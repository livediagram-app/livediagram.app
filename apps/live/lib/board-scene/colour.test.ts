import { describe, expect, it } from 'vitest';
import { PEN_COLOUR_NAMES, STICKY_PRESETS, penColourHex } from '@livediagram/document';
import {
  colourAlpha,
  createColourResolver,
  lineColourFields,
  resolveFill,
  resolveStickyFill,
  textColourFields,
} from './colour';

// docs/specs/020-import-export/board-scene.md "Colours": ink, then a stock colour by name, then the
// exact hex. Every colour in the real Excalidraw boards is listed.
describe('resolveSceneColour', () => {
  const resolve = createColourResolver();

  it.each([
    // The real input: Excalidraw's strokes.
    ['#1e1e1e', { kind: 'ink' }],
    ['#868e96', { kind: 'hex', hex: '#868e96' }],
    ['#1971c2', { kind: 'stock', name: 'blue' }],
    ['#2f9e44', { kind: 'stock', name: 'green' }],
    ['#e03131', { kind: 'stock', name: 'red' }],
    ['#f08c00', { kind: 'stock', name: 'orange' }],
    // The rest of Excalidraw's stroke palette.
    ['#c2255c', { kind: 'stock', name: 'pink' }],
    ['#6741d9', { kind: 'stock', name: 'violet' }],
    ['#9c36b5', { kind: 'hex', hex: '#9c36b5' }],
    ['#0c8599', { kind: 'hex', hex: '#0c8599' }],
    ['#099268', { kind: 'hex', hex: '#099268' }],
    ['#846358', { kind: 'hex', hex: '#846358' }],
    // Neutrals at the edges.
    ['#000000', { kind: 'ink' }],
    ['#000', { kind: 'ink' }],
    ['#495057', { kind: 'hex', hex: '#495057' }],
    ['#ffffff', { kind: 'hex', hex: '#ffffff' }],
    // A navy is a colour, never ink.
    ['#1E3A8A', { kind: 'stock', name: 'blue' }],
    // Pastels are washes, never stock line colours.
    ['#a5d8ff', { kind: 'hex', hex: '#a5d8ff' }],
    ['#ffdf6b', { kind: 'hex', hex: '#ffdf6b' }],
  ])('%s resolves as %o', (hex, expected) => {
    expect(resolve({ hex })).toEqual(expected);
  });

  it('matches every stock colour’s own versions to itself', () => {
    for (const name of PEN_COLOUR_NAMES) {
      for (const board of ['light', 'dark'] as const) {
        expect(resolve({ hex: penColourHex(name, board) })).toEqual({ kind: 'stock', name });
      }
    }
  });

  it('reads the ink keyword and an absent colour', () => {
    expect(resolve('ink')).toEqual({ kind: 'ink' });
    expect(resolve(undefined)).toBeNull();
  });

  it('reads an unreadable colour as unreadable', () => {
    expect(resolve({ hex: 'blue' })).toEqual({ kind: 'unreadable' });
    expect(resolve({ hex: '#12345' })).toEqual({ kind: 'unreadable' });
  });
});

describe('colour fields per role', () => {
  it('writes nothing for ink, a name for a stock colour, the hex otherwise', () => {
    expect(lineColourFields({ kind: 'ink' })).toEqual({});
    expect(lineColourFields({ kind: 'stock', name: 'red' })).toEqual({ penColour: 'red' });
    expect(lineColourFields({ kind: 'hex', hex: '#868e96' })).toEqual({ strokeColor: '#868e96' });
    expect(textColourFields({ kind: 'stock', name: 'red' })).toEqual({ penTextColour: 'red' });
    expect(textColourFields({ kind: 'hex', hex: '#868e96' })).toEqual({ textColor: '#868e96' });
    expect(textColourFields(null)).toEqual({});
  });
});

describe('colourAlpha', () => {
  it('is opaque by default and clamped', () => {
    expect(colourAlpha({ hex: '#000000' })).toBe(1);
    expect(colourAlpha({ hex: '#000000', alpha: 0.4 })).toBe(0.4);
    expect(colourAlpha({ hex: '#000000', alpha: 7 })).toBe(1);
    expect(colourAlpha({ hex: '#000000', alpha: -1 })).toBe(0);
    expect(colourAlpha('ink')).toBe(1);
  });
});

describe('resolveFill', () => {
  it('keeps a fill’s hex, and lands no fill or a clear one unfilled', () => {
    expect(resolveFill(undefined)).toBeUndefined();
    expect(resolveFill({ hex: '#FFDF6B', alpha: 0 })).toBeUndefined();
    expect(resolveFill({ hex: '#FFDF6B' })).toBe('#ffdf6b');
    expect(resolveFill({ hex: '#1e1e1e' })).toBe('#1e1e1e');
    expect(resolveFill({ hex: 'nope' })).toBeUndefined();
  });
});

describe('resolveStickyFill', () => {
  it('takes the nearest sticky preset’s paper and ink', () => {
    const classic = STICKY_PRESETS.find((p) => p.id === 'sticky-classic')!;
    expect(resolveStickyFill({ hex: classic.fill })).toEqual({
      fillColor: classic.fill,
      textColor: classic.text,
      presetId: classic.id,
    });
    // Excalidraw's sticky note yellow lands on a yellow paper.
    expect(['sticky-classic', 'sticky-lemon']).toContain(
      resolveStickyFill({ hex: '#ffdf6b' }).presetId,
    );
    // Microsoft Whiteboard's blue notes land on Sky.
    expect(resolveStickyFill({ hex: '#a5d8ff' }).presetId).toBe('sticky-sky');
  });

  it('falls back to the first preset for an unreadable fill', () => {
    expect(resolveStickyFill({ hex: 'x' }).presetId).toBe(STICKY_PRESETS[0]!.id);
  });
});
