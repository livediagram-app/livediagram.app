import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_PATTERN_COLOR, type Tab } from '@livedesign/document';
import { resetAppearanceForTests, setAppearance } from '@livedesign/ui';
import { resolveTabBackdrop } from './themes';
import { MODE_PATTERNS, resolveViewBackdrop } from './view-backdrop';

// docs/specs/007-editor/editor-modes.md "One look": one backdrop colour in both modes; the pattern
// is the tab's in Diagram mode and the person's own in Draw mode.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'Tab 1', elements: [], ...over });

afterEach(() => resetAppearanceForTests());

describe('resolveViewBackdrop', () => {
  it('is the tab’s own backdrop in Diagram mode', () => {
    const t = tab({ theme: 'slate', backgroundColor: '#fdf2f8', backgroundPattern: 'grid' });
    expect(resolveViewBackdrop(t, { mode: 'diagram', drawPattern: 'blank' })).toEqual(
      resolveTabBackdrop(t),
    );
  });

  it('keeps the tab’s colours in Draw mode, and takes the person’s pattern', () => {
    const t = tab({
      theme: 'slate',
      backgroundColor: '#fdf2f8',
      patternColor: '#fbcfe8',
      backgroundPattern: 'grid',
      backgroundOpacity: 0.6,
    });
    expect(resolveViewBackdrop(t, { mode: 'draw', drawPattern: 'graph' })).toEqual({
      backgroundColor: '#fdf2f8',
      patternColor: '#fbcfe8',
      backgroundPattern: 'graph',
      backgroundOpacity: 0.6,
    });
  });

  it('keeps a custom canvas colour in Draw mode', () => {
    const t = tab({ backgroundColor: '#fde68a', patternColor: '#f59e0b' });
    expect(resolveViewBackdrop(t, { mode: 'draw', drawPattern: 'blank' }).backgroundColor).toBe(
      '#fde68a',
    );
  });

  it('paints the Default theme’s canvas for the viewer’s appearance in Draw mode', () => {
    setAppearance('light');
    expect(resolveViewBackdrop(tab(), { mode: 'draw', drawPattern: 'grid' })).toMatchObject({
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      patternColor: DEFAULT_PATTERN_COLOR,
      backgroundPattern: 'grid',
    });
    setAppearance('dark');
    expect(resolveViewBackdrop(tab(), { mode: 'draw', drawPattern: 'grid' }).backgroundColor).toBe(
      '#0d121a',
    );
  });

  // Pages and Plan each have a default canvas of their own, shown while the tab keeps its theme's pattern.
  it('paints Pages plain and Plan graph paper while the tab keeps its theme’s pattern', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'grid' });
    const view = (mode: 'pages' | 'plan') => ({ mode, drawPattern: 'graph' as const });
    expect(MODE_PATTERNS).toEqual({ pages: 'blank', plan: 'blank' });
    expect(resolveViewBackdrop(t, view('pages')).backgroundPattern).toBe('blank');
    expect(resolveViewBackdrop(t, view('plan')).backgroundPattern).toBe('blank');
    expect(resolveViewBackdrop(tab(), view('plan')).backgroundPattern).toBe('blank');
  });

  it('shows a pattern someone picked in Pages and Plan, as in Diagram', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'hexagonal' });
    for (const mode of ['pages', 'plan'] as const)
      expect(resolveViewBackdrop(t, { mode, drawPattern: 'graph' })).toEqual(resolveTabBackdrop(t));
  });
});
