import { describe, expect, it } from 'vitest';
import {
  LABEL_BACKDROP_CONTRAST,
  contrastRatio,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { withStyleOfTab, withThemeApplied } from './tab-theme-apply';
import { buildTemplatedTab } from './template-builders';

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

  it('hard-resets a tab whose previous theme no longer resolves (an id the catalogue no longer knows)', () => {
    const t = {
      id: 't',
      name: 'T',
      theme: 'gone',
      elements: [shape({ fillColor: '#123456' })],
    } as Tab;
    const out = withThemeApplied(t, 'forest');
    expect(out.theme).toBe('forest');
    expect((out.elements[0] as ShapeElement).fillColor).not.toBe('#123456');
    expect(out.backgroundColor).toBe(getTheme('forest').backgroundColor);
  });
});

// docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it".
// docs/specs/009-elements/lane.md "A lane in the tab's theme": the lanes of a laned flowchart follow the tab's
// theme whole, heading strip included, when the template is built and on every pick after.
describe('flowchart lanes in the tab’s theme', () => {
  const lanesOf = (tab: Tab) =>
    tab.elements.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === 'lane');

  it.each(['swimlane', 'approval-workflow'] as const)(
    'a %s built in a theme, then restyled, has every lane in the theme',
    (kind) => {
      const built = buildTemplatedTab(kind, 'forest', 't', 'Flow');
      const forest = getTheme('forest');
      expect(lanesOf(built).length).toBeGreaterThan(1);
      for (const lane of lanesOf(built)) {
        expect(lane.strokeColor).toBe(forest.elementStroke);
        expect(lane.headerFill).toBeUndefined();
      }
      for (const appearance of ['light', 'dark'] as const) {
        const sunset = getTheme('sunset', appearance);
        for (const lane of lanesOf(withThemeApplied(built, 'sunset', appearance))) {
          expect(lane.fillColor).toBe(sunset.elementFill);
          expect(lane.strokeColor).toBe(sunset.elementStroke);
          expect(lane.headerFill).toBeUndefined();
        }
      }
    },
  );

  it('a pick heals a lane saved with a themed border and the heading it was built with', () => {
    const forest = getTheme('forest', 'light');
    const stale = shape({
      shape: 'lane',
      fillColor: forest.elementFill!,
      strokeColor: forest.elementStroke!,
      headerFill: '#f3e8ff',
    });
    const out = withThemeApplied(
      { id: 't', name: 'T', theme: 'forest', elements: [stale] },
      'sunset',
      'light',
    );
    expect(lanesOf(out)[0]!.headerFill).toBeUndefined();
  });
});

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
