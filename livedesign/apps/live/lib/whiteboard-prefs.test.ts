// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WHITEBOARD_PREFS,
  colourLabel,
  WHITEBOARD_PEN_WIDTHS,
  loadWhiteboardPrefs,
  parseWhiteboardPrefs,
  penAdjustsColour,
  saveWhiteboardPrefs,
} from './whiteboard-prefs';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// docs/specs/023-draw-mode/drawing-tools.md "Markers".
describe('whiteboard pens', () => {
  it('offers the main pen and second and third pens, ink then blue then red, at medium width', () => {
    const pens = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(pens.map((p) => p.id)).toEqual(['main', 'second', 'third']);
    expect(pens.map((p) => p.colour)).toEqual([null, 'blue', 'red']);
    expect(new Set(pens.map((p) => p.width))).toEqual(new Set([1.5]));
  });

  it('keeps the widths subtle around Medium (1.5 px), then three progressively stronger', () => {
    expect(WHITEBOARD_PEN_WIDTHS.map((w) => [w.label, w.px])).toEqual([
      ['Fine', 1],
      ['Medium', 1.5],
      ['Bold', 2.5],
      ['Thick', 4],
      ['Heavy', 6],
      ['Broad', 9],
    ]);
  });

  it('stores and reads back each of the stronger widths by name', () => {
    for (const w of WHITEBOARD_PEN_WIDTHS.slice(3)) {
      const prefs = {
        ...DEFAULT_WHITEBOARD_PREFS,
        pens: DEFAULT_WHITEBOARD_PREFS.pens.map((p) => ({ ...p, width: w.px })),
      };
      saveWhiteboardPrefs(prefs);
      expect(loadWhiteboardPrefs().pens.map((p) => p.width)).toEqual([w.px, w.px, w.px]);
    }
  });

  it('lets only the second and third pens change colour; the main pen stays the default', () => {
    expect(DEFAULT_WHITEBOARD_PREFS.pens.map(penAdjustsColour)).toEqual([false, true, true]);
  });

  it('names a colour: the ink, a stock colour by name, a custom one by its hex', () => {
    expect(colourLabel(null)).toBe('Ink');
    expect(colourLabel('blue')).toBe('Blue');
    expect(colourLabel('#ff6b00')).toBe('#ff6b00');
  });
});

describe('parseWhiteboardPrefs', () => {
  it('falls back to the defaults for garbage', () => {
    expect(parseWhiteboardPrefs('not json')).toEqual(DEFAULT_WHITEBOARD_PREFS);
    expect(parseWhiteboardPrefs(42)).toEqual(DEFAULT_WHITEBOARD_PREFS);
    expect(parseWhiteboardPrefs(null)).toEqual(DEFAULT_WHITEBOARD_PREFS);
  });

  it('reads widths by preset name, never by px, so retuning the px keeps a choice', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'second', colour: 'violet', width: 'bold' },
        // A px width from before the presets were named: back to Medium.
        { id: 'third', colour: 'red', width: 4 },
      ],
    });
    expect(parsed.pens[1]).toEqual({ id: 'second', colour: 'violet', width: 2.5 });
    expect(parsed.pens[2]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[2]);
  });

  it('keeps the main pen in the ink, and lets the second and third pens take the ink too', () => {
    // Ink is a stock colour for any marker.
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'main', colour: '#e5484d', width: 'fine' },
        { id: 'second', colour: null, width: 'bold' },
        { id: 'third', width: 'medium' },
      ],
    });
    expect(parsed.pens[0]).toEqual({ id: 'main', colour: null, width: 1 });
    expect(parsed.pens[1]).toEqual({ id: 'second', colour: null, width: 2.5 });
    // Missing (not the ink): the pen's own default.
    expect(parsed.pens[2]!.colour).toBe('red');
  });

  it('keeps a stock or custom colour, and drops a pen it does not know', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'red', colour: 'green', width: 'bold' },
        { id: 'second', colour: 'violet', width: 'medium' },
        { id: 'third', colour: '#FF6B00', width: 'medium' },
      ],
    });
    expect(parsed.pens.map((p) => p.id)).toEqual(['main', 'second', 'third']);
    expect(parsed.pens[1]!.colour).toBe('violet');
    expect(parsed.pens[2]!.colour).toBe('#ff6b00');
  });
});

describe('storage', () => {
  it('round-trips through localStorage, widths stored by name', () => {
    const prefs = {
      pens: DEFAULT_WHITEBOARD_PREFS.pens.map((p) => (p.id === 'third' ? { ...p, width: 2.5 } : p)),
    };
    saveWhiteboardPrefs(prefs);
    const stored: unknown = JSON.parse(localStorage.getItem('livedesign:v2:whiteboard-pens')!);
    expect(stored).toHaveProperty(['pens', 2, 'width'], 'bold');
    expect(loadWhiteboardPrefs()).toEqual(prefs);
  });

  it('starts from the defaults when nothing is stored', () => {
    expect(loadWhiteboardPrefs()).toEqual(DEFAULT_WHITEBOARD_PREFS);
  });
});
