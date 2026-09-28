// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WHITEBOARD_BOARD, contrastRatio } from '@livediagram/diagram';
import {
  DEFAULT_WHITEBOARD_PREFS,
  WHITEBOARD_PEN_COLOURS,
  WHITEBOARD_PEN_WIDTHS,
  loadWhiteboardPrefs,
  parseWhiteboardPrefs,
  penLabel,
  penTelemetryType,
  saveWhiteboardPrefs,
} from './whiteboard-prefs';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('whiteboard pens', () => {
  it('starts with Ink, Red, Blue and Green at medium width', () => {
    const pens = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(pens.map((p) => p.id)).toEqual(['ink', 'red', 'blue', 'green']);
    expect(pens[0]!.colour).toBeNull();
    expect(new Set(pens.map((p) => p.width))).toEqual(new Set([4]));
  });

  it('offers widths Fine, Medium and Bold', () => {
    expect(WHITEBOARD_PEN_WIDTHS.map((w) => [w.label, w.px])).toEqual([
      ['Fine', 2],
      ['Medium', 4],
      ['Bold', 8],
    ]);
  });

  it.each(WHITEBOARD_PEN_COLOURS.filter((c) => c.hex !== null))(
    '$label reads on both boards (WCAG 1.4.11, 3:1)',
    ({ hex }) => {
      expect(contrastRatio(hex!, WHITEBOARD_BOARD.light)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hex!, WHITEBOARD_BOARD.dark)).toBeGreaterThanOrEqual(3);
    },
  );

  it('names a pen by colour and width for assistive tech', () => {
    const [ink, red] = DEFAULT_WHITEBOARD_PREFS.pens;
    expect(penLabel(ink!)).toBe('Ink pen, medium');
    expect(penLabel({ ...red!, width: 8 })).toBe('Red pen, bold');
    expect(penLabel({ ...red!, colour: '#1d7afc' })).toBe('Blue pen, medium');
  });

  it('reports the default name while a pen keeps its colour, Custom after', () => {
    const red = DEFAULT_WHITEBOARD_PREFS.pens[1]!;
    expect(penTelemetryType(red)).toBe('Red');
    expect(penTelemetryType({ ...red, width: 8 })).toBe('Red');
    expect(penTelemetryType({ ...red, colour: '#9061f9' })).toBe('Custom');
  });
});

describe('parseWhiteboardPrefs', () => {
  it('falls back to the defaults for garbage', () => {
    expect(parseWhiteboardPrefs('not json')).toEqual(DEFAULT_WHITEBOARD_PREFS);
    expect(parseWhiteboardPrefs(42)).toEqual(DEFAULT_WHITEBOARD_PREFS);
    expect(parseWhiteboardPrefs(null)).toEqual(DEFAULT_WHITEBOARD_PREFS);
  });

  it('keeps valid choices and repairs invalid ones field by field', () => {
    const parsed = parseWhiteboardPrefs({
      pens: [
        { id: 'red', colour: '#9061f9', width: 8 },
        { id: 'blue', colour: '#123456', width: 3 },
        { id: 'purple', colour: '#9061f9', width: 2 },
      ],
      activePenId: 'blue',
      recognise: true,
      eraserMode: 'partial',
    });
    expect(parsed.pens.map((p) => p.id)).toEqual(['ink', 'red', 'blue', 'green']);
    expect(parsed.pens[1]).toEqual({ id: 'red', colour: '#9061f9', width: 8 });
    // Off-list colour and width fall back to that pen's defaults.
    expect(parsed.pens[2]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[2]);
    expect(parsed).toMatchObject({ activePenId: 'blue', recognise: true, eraserMode: 'partial' });
  });

  it('lets a pen hold the ink', () => {
    const parsed = parseWhiteboardPrefs({ pens: [{ id: 'red', colour: null, width: 4 }] });
    expect(parsed.pens[1]!.colour).toBeNull();
  });

  it('rejects an unknown active pen, eraser mode or recognition flag', () => {
    const parsed = parseWhiteboardPrefs({ activePenId: 'x', eraserMode: 'x', recognise: 'yes' });
    expect(parsed).toMatchObject({ activePenId: 'ink', eraserMode: 'stroke', recognise: false });
  });
});

describe('storage', () => {
  it('round-trips through localStorage under its own key', () => {
    const prefs = { ...DEFAULT_WHITEBOARD_PREFS, recognise: true };
    saveWhiteboardPrefs(prefs);
    expect(localStorage.getItem('livediagram:v2:whiteboard-pens')).not.toBeNull();
    expect(loadWhiteboardPrefs()).toEqual(prefs);
  });

  it('starts from the defaults when nothing is stored', () => {
    expect(loadWhiteboardPrefs()).toEqual(DEFAULT_WHITEBOARD_PREFS);
  });
});
