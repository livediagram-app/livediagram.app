import { describe, expect, it } from 'vitest';
import { appearanceOf, isInvisibleOn, lineColour } from './colours';

const dark = { hex: '#1f1f1f' };

// docs/specs/020-import-export/whiteboard-import.md "Colours".
describe('appearanceOf', () => {
  it.each([
    [undefined, 'light'],
    [{ hex: '#1f1f1f' }, 'dark'],
    [{ hex: '#e1e1e1' }, 'light'],
    [{ hex: '#ffffff' }, 'light'],
  ] as const)('reads %o as %s', (bg, appearance) => {
    expect(appearanceOf(bg)).toBe(appearance);
  });
});

describe('lineColour', () => {
  it('passes every colour on a light board', () => {
    expect(lineColour({ hex: '#ebebeb' }, 'light')).toEqual({ hex: '#ebebeb' });
    expect(lineColour({ hex: '#000000' }, 'light')).toEqual({ hex: '#000000' });
  });

  it("reads a dark board's near-white as ink", () => {
    expect(lineColour({ hex: '#ebebeb' }, 'dark', dark)).toBe('ink');
    expect(lineColour({ hex: '#ffffff' }, 'dark', dark)).toBe('ink');
  });

  it('skips a line in the board colour (pure black is drawn as the board black)', () => {
    expect(lineColour({ hex: '#1f1f1f' }, 'dark', dark)).toBe('skip');
    expect(lineColour({ hex: '#000000' }, 'dark', dark)).toBe('skip');
  });

  it('passes colours and mid greys on a dark board', () => {
    expect(lineColour({ hex: '#02a556' }, 'dark', dark)).toEqual({ hex: '#02a556' });
    expect(lineColour({ hex: '#9f9f9f' }, 'dark', dark)).toEqual({ hex: '#9f9f9f' });
  });

  it('is not invisible on a different board', () => {
    expect(isInvisibleOn({ hex: '#1f1f1f' }, { hex: '#ffffff' })).toBe(false);
  });
});
