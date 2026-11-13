import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEASURE_CACHE_MAX,
  canvasTextMeasure,
  fitsWordByWord,
  measureGeneration,
  resetCanvasTextMeasure,
} from './canvas-text-measure';

// docs/specs/007-editor/flashcards.md "Long stacks stay quick": an unmounted card's words are measured by a canvas.
// Node has no canvas, so one is stood in for: a glyph is 10 px in a 400 face, 12 in a 700.
const measured: string[] = [];
function standIn(withFonts = true) {
  let font = '';
  const ctx = {
    get font() {
      return font;
    },
    set font(f: string) {
      font = f;
    },
    measureText: (t: string) => {
      measured.push(`${font}|${t}`);
      return { width: t.length * (font.includes('700') ? 12 : 10) };
    },
  };
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return ctx;
      }
    },
  );
  const listeners: (() => void)[] = [];
  if (withFonts)
    vi.stubGlobal('document', {
      fonts: { addEventListener: (_: string, fn: () => void) => listeners.push(fn) },
    });
  return { loadFont: () => listeners.forEach((fn) => fn()) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetCanvasTextMeasure();
  measured.length = 0;
});

describe('canvasTextMeasure', () => {
  it('measures nothing where there is no canvas', () => {
    expect(canvasTextMeasure()).toBeUndefined();
  });

  it('measures in the face asked, once per face and text', () => {
    standIn();
    const m = canvasTextMeasure()!;
    expect(m('word', '400 16px Inter')).toBe(40);
    expect(m('word', '700 16px Inter')).toBe(48);
    expect(m('word', '400 16px Inter')).toBe(40);
    expect(measured).toEqual(['400 16px Inter|word', '700 16px Inter|word']);
  });

  it('fits word by word in WebKit, every browser on iOS included, and whole in Blink and Gecko', () => {
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    const iosChrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
    const firefox =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0';
    expect([safari, iosChrome, chrome, firefox].map(fitsWordByWord)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(fitsWordByWord('AppleWebKit/537.36 Chromium/130.0')).toBe(false);
    standIn();
    vi.stubGlobal('navigator', { userAgent: safari });
    expect(canvasTextMeasure()!.wordByWord).toBe(true);
  });

  it('measures afresh, and moves its generation on, once a web font loads', () => {
    const { loadFont } = standIn();
    const m = canvasTextMeasure()!;
    m('word', '400 16px Inter');
    expect(measureGeneration()).toBe(0);
    loadFont();
    expect(measureGeneration()).toBe(1);
    m('word', '400 16px Inter');
    expect(measured).toHaveLength(2);
  });

  it('starts its store again past its cap', () => {
    standIn(false);
    const m = canvasTextMeasure()!;
    for (let i = 0; i <= MEASURE_CACHE_MAX; i++) m(`w${i}`, '400 16px Inter');
    m('w1', '400 16px Inter');
    expect(measured.filter((k) => k.endsWith('|w1'))).toHaveLength(2);
  });

  it('falls back to a page canvas, and to nothing when the canvas will not draw', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    expect(canvasTextMeasure()).toBeUndefined();
    resetCanvasTextMeasure();
    vi.stubGlobal('document', {
      createElement: () => {
        throw new Error('no canvas');
      },
    });
    expect(canvasTextMeasure()).toBeUndefined();
    resetCanvasTextMeasure();
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({ font: '', measureText: () => ({ width: 7 }) }),
      }),
    });
    expect(canvasTextMeasure()!('a', '400 16px Inter')).toBe(7);
  });
});
