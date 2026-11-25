import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, ShapeElement } from './index';
import type { Tab } from './tab-type';
import { getBuiltInTheme } from './themes';
import { isTabThemeId, resolveThemeIn, tabWithStyle, tabWithTheme } from './tab-theme-apply';

// A theme, a finish and a font applied to a whole tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours
// panel", docs/specs/024-agents/agent-changesets.md "Style"): the one transform the editor's pick and the api's style
// changeset both run.
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

describe('isTabThemeId', () => {
  it('knows the catalogue, board themes and the default included', () => {
    expect(isTabThemeId('forest')).toBe(true);
    expect(isTabThemeId('office')).toBe(true);
    expect(isTabThemeId('brand')).toBe(true);
    expect(isTabThemeId('nope')).toBe(false);
    expect(isTabThemeId('')).toBe(false);
  });
});

describe('tabWithTheme', () => {
  const brand = resolveThemeIn('brand', 'light')!;
  const forest = resolveThemeIn('forest', 'light')!;

  it('recolours what is still on the old theme on a Board tab, keeps a hand-set colour, and sets the theme', () => {
    const tab: Tab = {
      id: 't',
      name: 'Board',
      kind: 'board',
      theme: 'brand',
      backgroundColor: brand.backgroundColor,
      elements: [
        shape({ id: 'on', fillColor: brand.elementFill! }),
        shape({ id: 'mine', fillColor: '#123456' }),
        arrow({ strokeColor: '#654321' }),
      ],
    };
    const out = tabWithTheme(tab, 'forest', 'light');
    expect(out.theme).toBe('forest');
    expect(out.kind).toBe('board');
    expect(out.backgroundColor).toBe(forest.backgroundColor);
    const byId = new Map(out.elements.map((e) => [e.id, e]));
    expect((byId.get('on') as ShapeElement).fillColor).toBe(forest.elementFill);
    expect((byId.get('mine') as ShapeElement).fillColor).toBe('#123456');
    expect((byId.get('a') as ArrowElement).strokeColor).not.toBe('#654321');
  });

  it('records the theme and its backdrop on a canvas tab that had none', () => {
    const out = tabWithTheme({ id: 't', name: 'T', elements: [] }, 'forest', 'light');
    expect(out.theme).toBe('forest');
    expect(out.backgroundColor).toBe(forest.backgroundColor);
  });

  it('gives a Form tab, which holds no elements, the theme its form wears', () => {
    const out = tabWithTheme(
      { id: 'f', name: 'Form', kind: 'form', elements: [] },
      'office',
      'light',
    );
    expect(out).toMatchObject({ kind: 'form', theme: 'office' });
  });

  it('resets a tab whose old theme names nothing known', () => {
    const out = tabWithTheme(
      { id: 't', name: 'T', theme: 'gone', elements: [shape({ fillColor: '#123456' })] },
      'forest',
      'light',
    );
    expect((out.elements[0] as ShapeElement).fillColor).not.toBe('#123456');
    expect(out.backgroundColor).toBe(getBuiltInTheme('forest', 'light').backgroundColor);
  });

  it('leaves the tab it was given as it was', () => {
    const tab: Tab = { id: 't', name: 'T', theme: 'brand', elements: [shape()] };
    const before = JSON.stringify(tab);
    tabWithTheme(tab, 'forest', 'light');
    expect(JSON.stringify(tab)).toBe(before);
  });
});

describe('tabWithStyle', () => {
  it('sets the finish and the font, every element following them again', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [shape({ finish: 'marker', font: 'oswald' })],
    };
    const out = tabWithStyle(tab, { finish: 'sketch', font: 'inter' }, 'light');
    expect(out).toMatchObject({ finish: 'sketch', font: 'inter' });
    expect(out.elements[0]).not.toHaveProperty('finish');
    expect(out.elements[0]).not.toHaveProperty('font');
    expect(out.theme).toBeUndefined();
  });

  it('applies the theme first, leaving what it was not given', () => {
    const tab: Tab = { id: 't', name: 'T', finish: 'marker', elements: [] };
    const out = tabWithStyle(tab, { theme: 'forest' }, 'light');
    expect(out).toMatchObject({ theme: 'forest', finish: 'marker' });
  });
});
