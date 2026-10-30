import { describe, expect, it } from 'vitest';
import {
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livedocuments/document';
import { getTheme } from '@/lib/themes';
import { withStyleOfTab, withThemeApplied } from './tab-theme-apply';

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

  it('hard-resets a tab whose previous theme no longer resolves (a theme id no built-in names)', () => {
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

// Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs").
describe('withStyleOfTab', () => {
  it("puts the source's theme, canvas, text defaults and finish on the target, keeping its name and content", () => {
    const source = {
      id: 'src',
      name: 'Source',
      elements: [],
      theme: 'ocean',
      finish: 'sketch',
      backgroundPattern: 'dots',
      font: 'serif',
    } as unknown as Tab;
    const target = {
      id: 't',
      name: 'Target',
      elements: [],
      backgroundColor: '#123456',
      defaultTextSize: 'lg',
    } as unknown as Tab;
    const next = withStyleOfTab(target, source) as unknown as Record<string, unknown>;
    expect(next).toMatchObject({
      id: 't',
      name: 'Target',
      theme: 'ocean',
      finish: 'sketch',
      backgroundPattern: 'dots',
      font: 'serif',
    });
    // A setting the source leaves unset is cleared on the target.
    expect(next.backgroundColor).toBeUndefined();
    expect(next.defaultTextSize).toBeUndefined();
  });

  it('applies the default theme when the source has none', () => {
    const next = withStyleOfTab(
      { id: 't', name: 'T', elements: [], theme: 'ocean' },
      { id: 's', name: 'S', elements: [] },
    );
    expect(next.theme).toBe('brand');
  });
});
