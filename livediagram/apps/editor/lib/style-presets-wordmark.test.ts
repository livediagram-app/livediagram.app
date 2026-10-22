import { describe, expect, it } from 'vitest';
import type { Element, TextElement } from '@livediagram/document';
import { applyWordmarkToEl } from './style-presets';

// docs/specs/007-editor/logo-pages.md "Wordmark type": the patch the Wordmark section commits.
describe('applyWordmarkToEl', () => {
  const text: TextElement = { id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10 };

  it('sets and clamps each field, null clearing it', () => {
    const el = applyWordmarkToEl(
      { ...text, textArc: 40 },
      { letterSpacing: 3, textCase: 'upper', textArc: null },
    ) as TextElement;
    expect(el).toEqual({ ...text, letterSpacing: 1, textCase: 'upper' });
    expect(applyWordmarkToEl(el, { letterSpacing: null, textCase: null })).toEqual(text);
    expect((applyWordmarkToEl(text, { textArc: 999 }) as TextElement).textArc).toBe(360);
  });

  it('clears bold when a weight is chosen, and keeps it when the weight is cleared', () => {
    expect(applyWordmarkToEl({ ...text, textBold: true }, { fontWeight: 500 })).toEqual({
      ...text,
      fontWeight: 500,
    });
    expect(
      applyWordmarkToEl({ ...text, textBold: true, fontWeight: 500 }, { fontWeight: null }),
    ).toEqual({
      ...text,
      textBold: true,
    });
  });

  it('leaves every other element alone', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    } as Element;
    expect(applyWordmarkToEl(shape, { textArc: 90 })).toBe(shape);
  });
});
