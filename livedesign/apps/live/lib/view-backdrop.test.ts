import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND_COLOR, type Tab } from '@livedesign/document';
import { resetAppearanceForTests, setAppearance } from '@livedesign/ui';
import { resolveTabBackdrop } from './themes';
import { PAGES_PATTERN, resolveViewBackdrop } from './view-backdrop';

// docs/specs/011-theme/light-and-dark.md: the tab's own colours, the surround plain while the tab
// keeps its theme's pattern.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'Tab 1', elements: [], ...over });

afterEach(() => resetAppearanceForTests());

describe('resolveViewBackdrop', () => {
  it('paints the surround plain while the tab keeps its theme’s pattern', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'grid' });
    expect(PAGES_PATTERN).toBe('blank');
    expect(resolveViewBackdrop(t).backgroundPattern).toBe('blank');
    expect(resolveViewBackdrop(tab()).backgroundPattern).toBe('blank');
  });

  it('shows a pattern someone picked', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'hexagonal' });
    expect(resolveViewBackdrop(t)).toEqual(resolveTabBackdrop(t));
  });

  it('keeps a custom canvas colour', () => {
    const t = tab({ backgroundColor: '#fde68a', patternColor: '#f59e0b' });
    expect(resolveViewBackdrop(t).backgroundColor).toBe('#fde68a');
  });

  it('paints the Default theme’s canvas for the viewer’s appearance', () => {
    setAppearance('light');
    expect(resolveViewBackdrop(tab()).backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
    setAppearance('dark');
    expect(resolveViewBackdrop(tab()).backgroundColor).toBe('#0d121a');
  });
});
