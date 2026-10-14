import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { getBuiltInTheme, themedForTab } from './themes';
import type { Element } from './index';

// docs/specs/007-editor/illustrate-pages.md "Layouts": a placed layout takes its tab's theme where it sets no colour.
describe('a layout in its tab’s theme', () => {
  const bare = { ...createShape('circle', 0, 0), id: 'c' } as Element;
  const accented = { ...createShape('square', 0, 0), id: 's', fillColor: '#ff0000' } as Element;

  it('fills each unset colour from a built-in theme, keeping the colours the layout set', () => {
    const mocha = getBuiltInTheme('mocha');
    const [circle, square] = themedForTab([bare, accented], 'mocha') as (Element & {
      fillColor?: string;
      strokeColor?: string;
    })[];
    expect(circle!.strokeColor).toBe(mocha.elementStroke);
    expect(square!.fillColor).toBe('#ff0000');
  });

  it('leaves it as built on the default scheme, a custom theme, or no theme', () => {
    for (const id of [undefined, 'brand', 'custom-1234'])
      expect(themedForTab([bare], id)).toEqual([bare]);
  });
});
