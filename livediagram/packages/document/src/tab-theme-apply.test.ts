import { describe, expect, it } from 'vitest';
import { getBuiltInTheme } from '@liveworkspace/element-model/themes';
import type { Element } from './element-union';
import { isTabThemeId, tabWithTheme } from './tab-theme-apply';
import { tabStyleIssue, tabThemeIds, withTabFinish, withTabFont } from './tab-style-transforms';
import type { Tab } from './tab-type';

// The pure Tab Style transforms (docs/specs/011-theme/canvas-and-theme-dialog.md "Agents"); the editor's own suite
// (apps/editor/lib/tab-theme-apply.test.ts) covers them through withThemeApplied.
const box = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60, ...over }) as Element;
const fillOf = (tab: Tab, id: string) =>
  (tab.elements.find((e) => e.id === id) as { fillColor?: string }).fillColor;

describe('tabWithTheme', () => {
  const forest = getBuiltInTheme('forest', 'light');
  const ocean = getBuiltInTheme('ocean', 'light');

  it('moves theme colours to the new theme, keeps hand-set ones, and records the theme and backdrop', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      theme: 'forest',
      elements: [box('a', { fillColor: forest.elementFill }), box('b', { fillColor: '#123456' })],
    };
    const out = tabWithTheme(tab, 'ocean', 'light');
    expect(out.theme).toBe('ocean');
    expect(out.backgroundColor).toBe(ocean.backgroundColor);
    expect(fillOf(out, 'a')).toBe(ocean.elementFill);
    expect(fillOf(out, 'b')).toBe('#123456');
  });

  it('resets a tab whose old theme nobody knows outright', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      theme: 'gone',
      elements: [box('a', { fillColor: '#123456' })],
    };
    expect(fillOf(tabWithTheme(tab, 'ocean', 'light'), 'a')).not.toBe('#123456');
  });
});

describe('isTabThemeId and tabStyleIssue', () => {
  it('knows the catalogue and Default, and nothing else', () => {
    expect(isTabThemeId('forest')).toBe(true);
    expect(isTabThemeId('nope')).toBe(false);
    expect(tabThemeIds()).toContain('forest');
    expect(tabThemeIds().every(isTabThemeId)).toBe(true);
  });

  it('names the first unknown field with the ids it takes', () => {
    expect(tabStyleIssue({ theme: 'forest', finish: 'sketch', font: 'inter' })).toBeNull();
    expect(tabStyleIssue({ theme: 'nope' })?.field).toBe('theme');
    expect(tabStyleIssue({ finish: 'glossy' })).toEqual({
      field: 'finish',
      valid: ['flexible', 'professional', 'sketch', 'marker'],
    });
    expect(tabStyleIssue({ font: 'comic' })?.valid).toContain('inter');
  });
});

describe('withTabFinish and withTabFont', () => {
  it("set the tab's own and clear the elements'", () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [box('a', { finish: 'marker', font: 'lora' })],
    };
    const out = withTabFont(withTabFinish(tab, 'sketch'), 'inter');
    expect(out).toMatchObject({ finish: 'sketch', font: 'inter' });
    expect(out.elements[0]).not.toHaveProperty('finish');
    expect(out.elements[0]).not.toHaveProperty('font');
    expect(withTabFont(out, null)).not.toHaveProperty('font');
  });
});
