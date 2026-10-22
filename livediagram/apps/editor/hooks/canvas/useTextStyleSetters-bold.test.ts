import { describe, expect, it } from 'vitest';
import type { TextElement } from '@livediagram/document';
import { withTextStyle } from './useTextStyleSetters';

// docs/specs/007-editor/logo-pages.md "Wordmark type": the Bold button sets bold and clears a
// wordmark weight, so it always shows its result.
describe('withTextStyle', () => {
  const text: TextElement = { id: 't', type: 'text', x: 0, y: 0, width: 1, height: 1 };

  it('clears a text weight when bold is toggled', () => {
    expect(withTextStyle({ ...text, fontWeight: 500 }, 'textBold', true)).toEqual({
      ...text,
      textBold: true,
    });
  });

  it('keeps the weight when another style is toggled', () => {
    expect(withTextStyle({ ...text, fontWeight: 500 }, 'textItalic', true)).toEqual({
      ...text,
      fontWeight: 500,
      textItalic: true,
    });
  });
});
