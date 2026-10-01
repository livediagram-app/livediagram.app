import { describe, expect, it } from 'vitest';
import type { Element, TextElement } from '@livediagram/document';
import { hugLandedText, landedTextFonts } from './board-scene-hug';

// docs/specs/020-import-export/board-scene.md "In the editor": landed text boxes hug in our fonts.
const text = (over: Partial<TextElement> = {}): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 300,
  height: 90,
  label: 'Hi',
  ...over,
});

describe('hugLandedText', () => {
  it('hugs auto-width boxes to their text and set-width ones in height only', () => {
    const measure = () => () => ({ width: 50, height: 20 });
    const [auto, set, other] = hugLandedText(
      [
        text({ autoWidth: true }),
        text({ id: 'u' }),
        { id: 'f', type: 'frame' } as unknown as Element,
      ],
      measure,
    ) as TextElement[];
    expect(auto).toMatchObject({ width: 58, height: 24 });
    expect(set).toMatchObject({ width: 300, height: 24 });
    expect(other).toEqual({ id: 'f', type: 'frame' });
  });
});

describe('landedTextFonts', () => {
  it('lists each face once, the tab’s for unset ones', () => {
    expect(
      landedTextFonts([text({ font: 'caveat' }), text(), text({ font: 'caveat' })], 'inter'),
    ).toEqual(['caveat', 'inter']);
    expect(landedTextFonts([text()], undefined)).toEqual([]);
  });
});
