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
  it('offers three pens, Ink, Blue then Red, at medium width', () => {
    const pens = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(pens.map((p) => p.id)).toEqual(['ink', 'blue', 'red']);
    expect(pens[0]!.colour).toBeNull();
    expect(new Set(pens.map((p) => p.width))).toEqual(new Set([2.5]));
  });

  it('keeps the widths subtle: Fine, Medium and Bold', () => {
    expect(WHITEBOARD_PEN_WIDTHS.map((w) => [w.label, w.px])).toEqual([
      ['Fine', 1.5],
      ['Medium', 2.5],
      ['Bold', 4],
    ]);
  });

  it('lets only Blue and Red change colour; Ink stays the default', () => {
    expect(DEFAULT_WHITEBOARD_PREFS.pens.map(penAdjustsColour)).toEqual([false, true, true]);
    expect(WHITEBOARD_PEN_COLOURS.some((c) => c.hex === null)).toBe(false);
  });

  it.each(WHITEBOARD_PEN_COLOURS)('$label reads on both boards (WCAG 1.4.11, 3:1)', ({ hex }) => {
    expect(contrastRatio(hex, WHITEBOARD_BOARD.light)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex, WHITEBOARD_BOARD.dark)).toBeGreaterThanOrEqual(3);
  });

  it('names a pen by colour and width for assistive tech', () => {
    const [ink, blue] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penLabel(ink!)).toBe('Ink pen, medium');
    expect(penLabel({ ...blue!, width: 4 })).toBe('Blue pen, bold');
    expect(penLabel({ ...blue!, colour: '#9061f9' })).toBe('Violet pen, medium');
  });

  it('reports the default name while a pen keeps its colour, Custom after', () => {
    const red = DEFAULT_WHITEBOARD_PREFS.pens[2]!;
    expect(penTelemetryType(red)).toBe('Red');
    expect(penTelemetryType({ ...red, width: 4 })).toBe('Red');
    expect(penTelemetryType({ ...red, colour: '#9061f9' })).toBe('Custom');
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
        { id: 'blue', colour: '#9061f9', width: 'bold' },
        // A px width from before the presets were named: back to Medium.
        { id: 'red', colour: '#e5484d', width: 4 },
      ],
    });
    expect(parsed.pens[1]).toEqual({ id: 'blue', colour: '#9061f9', width: 4 });
    expect(parsed.pens[2]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[2]);
  });

  it('never gives the Ink pen a colour, nor an adjustable pen the ink', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'ink', colour: '#e5484d', width: 'fine' },
        { id: 'blue', colour: null, width: 'medium' },
      ],
    });
    expect(parsed.pens[0]).toEqual({ id: 'ink', colour: null, width: 1.5 });
    expect(parsed.pens[1]!.colour).toBe(DEFAULT_WHITEBOARD_PREFS.pens[1]!.colour);
  });

  it('drops a pen the dock no longer has and repairs an active pen that is gone', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [{ id: 'green', colour: '#2f9e44', width: 'bold' }],
      activePenId: 'green',
    });
    expect(parsed.pens.map((p) => p.id)).toEqual(['ink', 'blue', 'red']);
    expect(parsed.activePenId).toBe('ink');
  });

  it('keeps valid choices and rejects unknown values', () => {
    const parsed = parseWhiteboardPrefs({ activePenId: 'red', eraserMode: 'x', recognise: 'yes' });
    expect(parsed).toMatchObject({ activePenId: 'red', eraserMode: 'stroke', recognise: false });
  });
});

describe('storage', () => {
  it('round-trips through localStorage, widths stored by name', () => {
    const prefs = {
      ...DEFAULT_WHITEBOARD_PREFS,
      recognise: true,
      pens: DEFAULT_WHITEBOARD_PREFS.pens.map((p) => (p.id === 'red' ? { ...p, width: 4 } : p)),
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
