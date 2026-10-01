import { afterEach, describe, expect, it } from 'vitest';
import { WHITEBOARD_BOARD, WHITEBOARD_PATTERN, createShape, type Tab } from '@livediagram/document';
import { resetAppearanceForTests, setAppearance } from '@livediagram/ui';
import { deriveNewBoxedColours, getTheme, resolveTabBackdrop, switchThemeBackdrop } from './themes';

// The Default theme follows the VIEWER (docs/specs/007-editor/live-app.md): the document stores
// one scheme, and light and dark chrome each render it their own way. Two
// people on the same tab therefore see different canvases, on purpose — and
// neither of them writes anything to the document by switching.
//
// Everything here is the live half of that: which definition `getTheme`
// resolves, which backdrop the canvas paints, and the rule that keeps Default
// from ever baking a colour (which is what would break the other viewer).

const tab = (over: Partial<Tab> = {}): Tab =>
  ({ id: 't1', name: 'Tab 1', elements: [], ...over }) as Tab;

afterEach(() => {
  resetAppearanceForTests();
});

describe('getTheme under an appearance', () => {
  it('resolves Default to the half the viewer is in', () => {
    setAppearance('light');
    expect(getTheme('brand').backgroundColor).toBe('#ffffff');
    setAppearance('dark');
    expect(getTheme('brand').backgroundColor).toBe('#0d121a');
  });

  it('resolves an unthemed tab the same way', () => {
    // A tab that never had a scheme picked IS on Default, so it follows too.
    setAppearance('dark');
    expect(getTheme(undefined).backgroundColor).toBe('#0d121a');
  });

  it('leaves every other scheme alone', () => {
    setAppearance('dark');
    // Pink is a choice somebody made and stored; the viewer's chrome does not
    // get to reinterpret it.
    expect(getTheme('slate').backgroundColor).toBe('#fdf2f8');
    expect(getTheme('midnight').backgroundColor).toBe('#0f172a');
  });

  it('takes an explicit appearance, for callers that are not the viewer', () => {
    setAppearance('light');
    expect(getTheme('brand', 'dark').backgroundColor).toBe('#0d121a');
  });
});

describe('resolveTabBackdrop', () => {
  it('paints a whiteboard board in both appearances, ignoring the stored theme', () => {
    // docs/specs/023-whiteboard/whiteboard.md "Appearance": the board ignores any stored theme or colour.
    const t = tab({
      kind: 'whiteboard',
      theme: 'midnight',
      backgroundColor: '#fde68a',
      patternColor: '#f59e0b',
      backgroundPattern: 'graph',
      backgroundOpacity: 0.4,
    });
    setAppearance('light');
    expect(resolveTabBackdrop(t)).toEqual({
      backgroundColor: WHITEBOARD_BOARD.light,
      patternColor: WHITEBOARD_PATTERN.light,
      backgroundPattern: 'graph',
      backgroundOpacity: 1,
    });
    setAppearance('dark');
    expect(resolveTabBackdrop(t)).toMatchObject({
      backgroundColor: WHITEBOARD_BOARD.dark,
      patternColor: WHITEBOARD_PATTERN.dark,
    });
  });

  it('keeps a whiteboard stored without a pattern on Plain, as it always showed', () => {
    expect(resolveTabBackdrop(tab({ kind: 'whiteboard' })).backgroundPattern).toBe('blank');
  });

  it('paints a Default tab in the viewer’s appearance', () => {
    const t = tab({ theme: 'brand', backgroundColor: '#ffffff', patternColor: '#cbd5e1' });
    setAppearance('dark');
    expect(resolveTabBackdrop(t)).toMatchObject({
      backgroundColor: '#0d121a',
      patternColor: '#1c2735',
    });
    setAppearance('light');
    expect(resolveTabBackdrop(t)).toMatchObject({
      backgroundColor: '#ffffff',
      patternColor: '#cbd5e1',
    });
  });

  it('paints a Default tab saved in the OTHER appearance correctly too', () => {
    // Someone in dark chrome picked Default, so the tab carries the dark
    // backdrop. A light-chrome viewer must still see white, or the whole
    // point of merging the two schemes is lost.
    const t = tab({ theme: 'brand', backgroundColor: '#0d121a', patternColor: '#1c2735' });
    setAppearance('light');
    expect(resolveTabBackdrop(t).backgroundColor).toBe('#ffffff');
  });

  it('paints an unthemed tab as Default', () => {
    setAppearance('dark');
    expect(resolveTabBackdrop(tab()).backgroundColor).toBe('#0d121a');
  });

  it('never overrides a hand-picked canvas colour', () => {
    // The user chose this backdrop deliberately. Their choice outranks their
    // chrome, in both directions.
    const t = tab({ theme: 'brand', backgroundColor: '#fde68a', patternColor: '#f59e0b' });
    setAppearance('dark');
    expect(resolveTabBackdrop(t)).toMatchObject({
      backgroundColor: '#fde68a',
      patternColor: '#f59e0b',
    });
  });

  it('leaves the pattern, opacity and scale exactly as stored', () => {
    // Appearance decides colours, never layout: a chosen Graph paper stays
    // Graph paper in both.
    const t = tab({
      theme: 'brand',
      backgroundColor: '#ffffff',
      patternColor: '#cbd5e1',
      backgroundPattern: 'graph',
      backgroundOpacity: 0.8,
    });
    setAppearance('dark');
    expect(resolveTabBackdrop(t)).toMatchObject({
      backgroundPattern: 'graph',
      backgroundOpacity: 0.8,
    });
  });

  it('leaves a tab on any other scheme untouched', () => {
    const t = tab({ theme: 'slate', backgroundColor: '#fdf2f8', patternColor: '#fbcfe8' });
    setAppearance('dark');
    expect(resolveTabBackdrop(t).backgroundColor).toBe('#fdf2f8');
  });
});

describe('Default never bakes a colour onto an element', () => {
  it('adds an element with no colours of its own, in either appearance', () => {
    for (const appearance of ['light', 'dark'] as const) {
      setAppearance(appearance);
      const t = resolveTabBackdrop(tab({ theme: 'brand' }));
      const colours = deriveNewBoxedColours(createShape('square', 0, 0), {
        backgroundColor: t.backgroundColor,
        patternColor: t.patternColor,
        theme: 'brand',
      });
      // Unset, not "set to the light default": a stored colour is what one
      // viewer's chrome would impose on every other viewer.
      expect(colours).toEqual({});
    }
  });

  it('still derives colours from a canvas the user coloured themselves', () => {
    // The opt-out is Default's, not dark's: a hand-picked backdrop still
    // drives new elements the way it always has.
    setAppearance('dark');
    const colours = deriveNewBoxedColours(createShape('square', 0, 0), {
      backgroundColor: '#fde68a',
      patternColor: '#f59e0b',
      theme: 'brand',
    });
    expect(colours.strokeColor).toBe('#f59e0b');
  });
});

describe('switching away from Default', () => {
  it('applies the new scheme’s backdrop whichever half the tab was saved in', () => {
    // The preserve-customs rule compares against the PREVIOUS scheme's
    // backdrop. Default has two, so comparing against only the viewer's half
    // would read the other half as a hand-picked colour and refuse to move.
    const prev = getTheme('brand', 'light');
    const next = getTheme('slate');
    const savedInDark = { backgroundColor: '#0d121a', patternColor: '#1c2735' };
    expect(switchThemeBackdrop(savedInDark, prev, next)).toMatchObject({
      backgroundColor: next.backgroundColor,
      patternColor: next.patternColor,
    });
  });

  it('still keeps a hand-picked backdrop', () => {
    const prev = getTheme('brand', 'light');
    const next = getTheme('slate');
    expect(switchThemeBackdrop({ backgroundColor: '#fde68a' }, prev, next).backgroundColor).toBe(
      '#fde68a',
    );
  });
});
