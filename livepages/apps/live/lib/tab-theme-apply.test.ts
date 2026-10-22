import { describe, expect, it } from 'vitest';
import { type ArrowElement, type Element, type ShapeElement, type Tab } from '@livepages/document';
import { getTheme } from '@/lib/themes';
import { withThemeApplied } from './tab-theme-apply';

// Applying a theme to a tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel").
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

describe('withThemeApplied', () => {
  it('records the theme and its backdrop on a tab that had none', () => {
    const forest = getTheme('forest');
    const out = withThemeApplied({ id: 't', name: 'T', elements: [] }, 'forest');
    expect(out.theme).toBe('forest');
    expect(out.backgroundColor).toBe(forest.backgroundColor);
  });

  it('keeps a colour the user set, and re-tints every arrow', () => {
    const t = {
      id: 't',
      name: 'T',
      theme: 'brand',
      elements: [shape({ fillColor: '#123456' }), arrow({ strokeColor: '#654321' })],
    } as Tab;
    const out = withThemeApplied(t, 'forest');
    expect((out.elements[0] as ShapeElement).fillColor).toBe('#123456');
    expect((out.elements[1] as ArrowElement).strokeColor).not.toBe('#654321');
  });

  it('hard-resets a tab whose previous theme no longer resolves (a deleted custom theme)', () => {
    const t = {
      id: 't',
      name: 'T',
      theme: 'custom:gone',
      elements: [shape({ fillColor: '#123456' })],
    } as Tab;
    const out = withThemeApplied(t, 'forest');
    expect(out.theme).toBe('forest');
    expect((out.elements[0] as ShapeElement).fillColor).not.toBe('#123456');
    expect(out.backgroundColor).toBe(getTheme('forest').backgroundColor);
  });
});
