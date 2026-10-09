// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WHITEBOARD_PREFS,
  colourLabel,
  WHITEBOARD_PEN_WIDTHS,
  loadWhiteboardPrefs,
  parseWhiteboardPrefs,
  penAdjustsColour,
  penLabel,
  penTelemetryType,
  saveWhiteboardPrefs,
} from './whiteboard-prefs';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// docs/specs/023-draw-mode/draw-mode.md "Pens".
describe('whiteboard pens', () => {
  it('offers the main pen and second and third pens, ink then blue then red, at medium width', () => {
    const pens = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(pens.map((p) => p.id)).toEqual(['main', 'second', 'third']);
    expect(pens.map((p) => p.colour)).toEqual([null, 'blue', 'red']);
    expect(new Set(pens.map((p) => p.width))).toEqual(new Set([1.5]));
  });

  it('keeps the widths subtle: Medium is 1.5 px, a notch either side', () => {
    expect(WHITEBOARD_PEN_WIDTHS.map((w) => [w.label, w.px])).toEqual([
      ['Fine', 1],
      ['Medium', 1.5],
      ['Bold', 2.5],
    ]);
  });

  it('lets only the second and third pens change colour; the main pen stays the default', () => {
    expect(DEFAULT_WHITEBOARD_PREFS.pens.map(penAdjustsColour)).toEqual([false, true, true]);
  });

  it('names a colour: the ink, a stock colour by name, a custom one by its hex', () => {
    expect(colourLabel(null)).toBe('Ink');
    expect(colourLabel('blue')).toBe('Blue');
    expect(colourLabel('#ff6b00')).toBe('#ff6b00');
  });

  it('names a pen by colour and width for assistive tech', () => {
    const [main, first] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penLabel(main!)).toBe('Marker 1, medium');
    expect(penLabel({ ...first!, width: 2.5 })).toBe('Marker 2, blue, bold');
    expect(penLabel({ ...first!, colour: 'violet' })).toBe('Marker 2, violet, medium');
    expect(penLabel({ ...first!, colour: null })).toBe('Marker 2, ink, medium');
    expect(penLabel({ ...first!, colour: '#ff6b00' })).toBe('Marker 2, #ff6b00, medium');
  });

  it('reports a pen by its place, never its colour', () => {
    const [main, first, second] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penTelemetryType(main!)).toBe('Main');
    expect(penTelemetryType({ ...first!, colour: 'violet' })).toBe('Second');
    expect(penTelemetryType(second!)).toBe('Third');
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
    // docs/specs/023-draw-mode/draw-mode.md "The colour picker": Ink is a stock colour for any marker.
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

  it('keeps a stock or custom colour, and reads an old fixed colour as its name', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'second', colour: '#9061F9', width: 'medium' },
        { id: 'third', colour: '#FF6B00', width: 'medium' },
      ],
    });
    expect(parsed.pens[1]!.colour).toBe('violet');
    expect(parsed.pens[2]!.colour).toBe('#ff6b00');
    for (const [hex, name] of [
      ['#1d7afc', 'blue'],
      ['#e5484d', 'red'],
      ['#d9480f', 'orange'],
      ['#2f9e44', 'green'],
      ['#0c8599', 'teal'],
      ['#e64980', 'pink'],
    ]) {
      expect(parseWhiteboardPrefs({ pens: [{ id: 'second', colour: hex }] }).pens[1]!.colour).toBe(
        name,
      );
    }
    expect(
      parseWhiteboardPrefs({ pens: [{ id: 'second', colour: 'blue-3' }] }).pens[1]!.colour,
    ).toBe('blue');
  });

  it('drops a pen the dock no longer has and repairs an active pen that is gone', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [{ id: 'red', colour: '#2f9e44', width: 'bold' }],
      activePenId: 'red',
    });
    expect(parsed.pens.map((p) => p.id)).toEqual(['main', 'second', 'third']);
    expect(parsed.activePenId).toBe('main');
  });

  it('keeps valid choices and rejects unknown values', () => {
    const parsed = parseWhiteboardPrefs({
      activePenId: 'third',
      eraserMode: 'x',
      recognise: 'yes',
    });
    expect(parsed).toMatchObject({
      activePenId: 'third',
      eraserMode: 'stroke',
      recognise: false,
    });
  });
});

describe('the pen cursor', () => {
  it('starts as the crosshair with a nib and keeps a valid choice', () => {
    expect(DEFAULT_WHITEBOARD_PREFS.cursor).toBe('nib-crosshair');
    expect(parseWhiteboardPrefs({ cursor: 'dot' }).cursor).toBe('dot');
    expect(parseWhiteboardPrefs({ cursor: 'ring' }).cursor).toBe('nib-crosshair');
  });
});

describe('storage', () => {
  it('round-trips through localStorage, widths stored by name', () => {
    const prefs = {
      ...DEFAULT_WHITEBOARD_PREFS,
      recognise: true,
      pens: DEFAULT_WHITEBOARD_PREFS.pens.map((p) => (p.id === 'third' ? { ...p, width: 2.5 } : p)),
    };
    saveWhiteboardPrefs(prefs);
    const stored = JSON.parse(localStorage.getItem('livediagram:v2:whiteboard-pens')!);
    expect(stored.pens[2].width).toBe('bold');
    expect(loadWhiteboardPrefs()).toEqual(prefs);
  });

  it('starts from the defaults when nothing is stored', () => {
    expect(loadWhiteboardPrefs()).toEqual(DEFAULT_WHITEBOARD_PREFS);
  });
});
