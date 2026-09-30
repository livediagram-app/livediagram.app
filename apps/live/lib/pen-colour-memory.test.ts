import { describe, expect, it } from 'vitest';
import {
  YOUR_COLOURS_MAX,
  forgetPenColour,
  readPenColourMemory,
  rememberPenColour,
  withPenColourMemory,
  type PenColourMemory,
} from './pen-colour-memory';

const empty: PenColourMemory = { yours: [] };

// docs/specs/023-whiteboard/whiteboard.md "The colour picker": Your colours.
describe('Your colours', () => {
  it('remembers nothing for the ink or a stock colour', () => {
    expect(rememberPenColour(empty, null)).toBe(empty);
    expect(rememberPenColour(empty, 'blue')).toBe(empty);
  });

  it('puts a custom colour at the front, lower case', () => {
    const m = rememberPenColour({ yours: ['#00a39b'] }, '#FF6B00');
    expect(m).toEqual({ yours: ['#ff6b00', '#00a39b'] });
  });

  it('moves a colour used again to the front, and keeps eight', () => {
    let m = empty;
    for (let i = 0; i < 10; i++) m = rememberPenColour(m, `#00000${i}`);
    expect(YOUR_COLOURS_MAX).toBe(8);
    expect(m.yours).toHaveLength(8);
    expect(m.yours[0]).toBe('#000009');
    m = rememberPenColour(m, '#000006');
    expect(m.yours[0]).toBe('#000006');
    expect(m.yours.filter((c) => c === '#000006')).toHaveLength(1);
    expect(rememberPenColour(m, '#000006')).toBe(m);
  });

  it('removes a custom colour, and nothing else', () => {
    const m = { yours: ['#ff6b00', '#00a39b'] };
    expect(forgetPenColour(m, '#FF6B00')).toEqual({ yours: ['#00a39b'] });
    expect(forgetPenColour(m, '#123456')).toBe(m);
  });

  it('reads only valid colours from the stored preferences, and writes them back', () => {
    const read = readPenColourMemory({
      whiteboardYourColours: ['#FF6B00', 'blue', 'junk', '#ff6b00', '#00a39b'],
    });
    expect(read).toEqual({ yours: ['#ff6b00', '#00a39b'] });
    expect(readPenColourMemory({})).toEqual(empty);
    expect(withPenColourMemory({ powerUserMode: true }, read)).toEqual({
      powerUserMode: true,
      whiteboardYourColours: ['#ff6b00', '#00a39b'],
    });
  });
});
