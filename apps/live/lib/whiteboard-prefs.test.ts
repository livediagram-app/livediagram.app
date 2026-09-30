// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WHITEBOARD_BOARD, contrastRatio } from '@livediagram/document';
import {
  DEFAULT_WHITEBOARD_PREFS,
  WHITEBOARD_PEN_COLOURS,
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

// docs/specs/023-whiteboard/whiteboard.md "Pens".
describe('whiteboard pens', () => {
  it('offers the main pen and second and third pens, blue then red, at medium width', () => {
    const pens = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(pens.map((p) => p.id)).toEqual(['main', 'second', 'third']);
    expect(pens[0]!.colour).toBeNull();
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
    expect(WHITEBOARD_PEN_COLOURS.some((c) => c.hex === null)).toBe(false);
  });

  it.each(WHITEBOARD_PEN_COLOURS)('$label reads on both boards (WCAG 1.4.11, 3:1)', ({ hex }) => {
    expect(contrastRatio(hex, WHITEBOARD_BOARD.light)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex, WHITEBOARD_BOARD.dark)).toBeGreaterThanOrEqual(3);
  });

  it('names a pen by colour and width for assistive tech', () => {
    const [main, first] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penLabel(main!)).toBe('Marker 1, medium');
    expect(penLabel({ ...first!, width: 2.5 })).toBe('Marker 2, blue, bold');
    expect(penLabel({ ...first!, colour: '#9061f9' })).toBe('Marker 2, violet, medium');
  });

  it('reports a pen by its place, never its colour', () => {
    const [main, first, second] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penTelemetryType(main!)).toBe('Main');
    expect(penTelemetryType({ ...first!, colour: '#9061f9' })).toBe('Second');
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
        { id: 'second', colour: '#9061f9', width: 'bold' },
        // A px width from before the presets were named: back to Medium.
        { id: 'third', colour: '#e5484d', width: 4 },
      ],
    });
    expect(parsed.pens[1]).toEqual({ id: 'second', colour: '#9061f9', width: 2.5 });
    expect(parsed.pens[2]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[2]);
  });

  it('never gives the main pen a colour, nor the second or third pen the ink', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'main', colour: '#e5484d', width: 'fine' },
        { id: 'second', colour: null, width: 'medium' },
      ],
    });
    expect(parsed.pens[0]).toEqual({ id: 'main', colour: null, width: 1 });
    expect(parsed.pens[1]!.colour).toBe(DEFAULT_WHITEBOARD_PREFS.pens[1]!.colour);
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
