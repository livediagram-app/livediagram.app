import { describe, expect, it } from 'vitest';
import {
  getBuiltInTheme,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from './index';
import { isTabThemeId, resolveThemeIn, tabWithTheme } from './tab-theme-apply';

// One theme pick's transform, the editor's and the agents' (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Element colours", "Agents").
const shape = (over: Partial<ShapeElement> = {}): Element => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...over,
});
const arrow = (over: Partial<ArrowElement> = {}): Element => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 50, y: 0 },
  ...over,
});
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

const ocean = getBuiltInTheme('ocean', 'light');
const forest = getBuiltInTheme('forest', 'light');

describe('tabWithTheme', () => {
  it('moves a colour still on the old theme, keeps one someone chose and records the theme', () => {
    const out = tabWithTheme(
      tab({
        theme: 'ocean',
        elements: [
          shape({ id: 'themed', fillColor: ocean.elementFill!, strokeColor: ocean.elementStroke! }),
          shape({ id: 'chosen', fillColor: '#123456' }),
          arrow({ id: 'hand', strokeColor: '#654321' }),
          arrow({ id: 'on-theme', strokeColor: ocean.elementStroke! }),
        ],
      }),
      'forest',
      'light',
    );
    const byId = (id: string) => out.elements.find((e) => e.id === id) as ShapeElement;
    expect(out.theme).toBe('forest');
    expect(byId('themed').fillColor).toBe(forest.elementFill);
    expect(byId('themed').strokeColor).toBe(forest.elementStroke);
    expect(byId('chosen').fillColor).toBe('#123456');
    expect((byId('hand') as unknown as ArrowElement).strokeColor).toBe('#654321');
    expect((byId('on-theme') as unknown as ArrowElement).strokeColor).toBe(forest.elementStroke);
  });

  it('takes the new backdrop on a tab whose backdrop was the old theme’s', () => {
    const out = tabWithTheme(
      tab({ theme: 'ocean', backgroundColor: ocean.backgroundColor }),
      'forest',
      'light',
    );
    expect(out.backgroundColor).toBe(forest.backgroundColor);
  });

  it('reads a tab with no theme as the default and keeps a colour chosen on it', () => {
    const out = tabWithTheme(
      tab({ elements: [shape({ fillColor: '#123456' })] }),
      'forest',
      'light',
    );
    expect(out.theme).toBe('forest');
    expect((out.elements[0] as ShapeElement).fillColor).toBe('#123456');
  });

  it('resets a tab on a theme nobody can resolve outright', () => {
    const out = tabWithTheme(
      tab({ theme: 'retired-scheme', elements: [shape({ fillColor: '#123456' })] }),
      'forest',
      'light',
    );
    expect(out.theme).toBe('forest');
    expect(out.backgroundColor).toBe(forest.backgroundColor);
    expect((out.elements[0] as ShapeElement).fillColor).not.toBe('#123456');
  });

  it('with keepElementColours recolours no element but still takes the backdrop', () => {
    const themed = shape({ fillColor: ocean.elementFill! });
    const out = tabWithTheme(
      tab({ theme: 'ocean', backgroundColor: ocean.backgroundColor, elements: [themed] }),
      'forest',
      'light',
      { keepElementColours: true },
    );
    expect(out.elements[0]).toBe(themed);
    expect(out.theme).toBe('forest');
    expect(out.backgroundColor).toBe(forest.backgroundColor);
  });

  it('paints in the half it is given', () => {
    const dark = tabWithTheme(tab(), 'forest', 'dark');
    expect(dark.backgroundColor).toBe(getBuiltInTheme('forest', 'dark').backgroundColor);
  });
});

describe('isTabThemeId and resolveThemeIn', () => {
  it('know the catalogue and the default, and nothing else', () => {
    expect(isTabThemeId('forest')).toBe(true);
    expect(isTabThemeId('brand')).toBe(true);
    expect(isTabThemeId('Forest')).toBe(false);
    expect(isTabThemeId('')).toBe(false);
    expect(resolveThemeIn('nope', 'light')).toBeUndefined();
    expect(resolveThemeIn(undefined, 'light')).toBeUndefined();
    expect(resolveThemeIn('forest', 'light')?.backgroundColor).toBe(forest.backgroundColor);
  });
});
