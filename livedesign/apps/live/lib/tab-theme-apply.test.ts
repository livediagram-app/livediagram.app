import { describe, expect, it } from 'vitest';
import {
  LABEL_BACKDROP_CONTRAST,
  contrastRatio,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livedesign/document';
import { getTheme } from '@/lib/themes';
import { labelsFollowCanvas, withThemeApplied } from './tab-theme-apply';

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

// docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it".
describe('labels a pick sank', () => {
  it('stores an ink that reads on the canvas the pick turned dark', () => {
    const caption = {
      id: 'c',
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 24,
      label: 'Caption',
      textColor: '#334155',
    } as unknown as Element;
    const out = withThemeApplied({ id: 't', name: 'T', elements: [caption] }, 'midnight', 'dark');
    const ink = (out.elements[0] as { textColor?: string }).textColor ?? '';
    expect(contrastRatio(ink, out.backgroundColor ?? '')).toBeGreaterThanOrEqual(
      LABEL_BACKDROP_CONTRAST,
    );
  });

  it('follows the canvas on every tab but a Pages one', () => {
    expect(labelsFollowCanvas({})).toBe(true);
    expect(labelsFollowCanvas({ opensIn: 'pages' })).toBe(false);
    expect(labelsFollowCanvas({ pages: [{ id: 'p', orientation: 'portrait' }] })).toBe(false);
  });
});
