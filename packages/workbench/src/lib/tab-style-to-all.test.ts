// Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs"): what is copied, what is
// left alone, and what the toast says.
import { describe, expect, it } from 'vitest';
import { styleAllMessage, styleAllTabs, withTabStyleOf, TAB_STYLE_KEYS } from './tab-style-to-all';

type T = {
  id: string;
  name: string;
  locked?: boolean;
  elements: string[];
  theme?: string;
  font?: string;
  finish?: string;
  backgroundPattern?: string;
  backgroundColor?: string;
  defaultTextSize?: string | number;
};

describe('withTabStyleOf', () => {
  it('copies every style setting the source sets and clears those it leaves unset, nothing else', () => {
    const target: T = {
      id: 'b',
      name: 'Beta',
      elements: ['x'],
      font: 'serif',
      backgroundColor: '#000',
      theme: 'ocean',
    };
    const source: T = {
      id: 'a',
      name: 'Alpha',
      elements: [],
      finish: 'sketch',
      backgroundPattern: 'dots',
      defaultTextSize: 18,
    };
    expect(withTabStyleOf(target, source)).toEqual({
      id: 'b',
      name: 'Beta',
      elements: ['x'],
      theme: 'ocean',
      finish: 'sketch',
      backgroundPattern: 'dots',
      defaultTextSize: 18,
    });
    // The target object itself is untouched.
    expect(target.font).toBe('serif');
  });

  it('names the canvas, text and finish settings, and never the theme (each editor applies that its own way)', () => {
    expect(TAB_STYLE_KEYS).toContain('backgroundPattern');
    expect(TAB_STYLE_KEYS).toContain('font');
    expect(TAB_STYLE_KEYS).toContain('finish');
    expect(TAB_STYLE_KEYS).not.toContain('theme' as never);
  });
});

describe('styleAllTabs', () => {
  const tabs: T[] = [
    { id: 'a', name: 'A', elements: ['1'], theme: 'ocean' },
    { id: 'b', name: 'B', elements: ['2'] },
    { id: 'c', name: 'C', elements: ['3'], locked: true },
    { id: 'd', name: 'D', elements: [] },
  ];
  const restyle = (t: T, s: T): T => ({ ...t, theme: s.theme });

  it('restyles every other writable tab from the source, keeping locked and unloaded tabs as they are', () => {
    const { tabs: next, outcome } = styleAllTabs(tabs, 'a', restyle, (t) => t.elements.length > 0);
    expect(next.map((t) => t.theme)).toEqual(['ocean', 'ocean', undefined, undefined]);
    expect(next[0]).toBe(tabs[0]);
    expect(next[2]).toBe(tabs[2]);
    // An unloaded tab keeps its object, so the autosave never writes its placeholder.
    expect(next[3]).toBe(tabs[3]);
    expect(outcome).toEqual({ styled: 1, locked: 1, unloaded: 1 });
  });

  it('changes nothing when the source tab is gone', () => {
    const { tabs: next, outcome } = styleAllTabs(tabs, 'zz', restyle, () => true);
    expect(next).toEqual(tabs);
    expect(outcome).toEqual({ styled: 0, locked: 0, unloaded: 0 });
  });
});

describe('styleAllMessage', () => {
  it('says how many tabs took the style', () => {
    expect(styleAllMessage({ styled: 1, locked: 0, unloaded: 0 })).toBe(
      'Applied this tab’s style to 1 other tab.',
    );
    expect(styleAllMessage({ styled: 3, locked: 0, unloaded: 0 })).toBe(
      'Applied this tab’s style to 3 other tabs.',
    );
  });

  it('names the tabs that kept their own, and says when none took it', () => {
    expect(styleAllMessage({ styled: 0, locked: 1, unloaded: 2 })).toBe(
      'No other tab took this style. 1 locked tab kept its own. 2 tabs couldn’t load and kept their own.',
    );
    expect(styleAllMessage({ styled: 2, locked: 2, unloaded: 1 })).toBe(
      'Applied this tab’s style to 2 other tabs. 2 locked tabs kept their own. 1 tab couldn’t load and kept its own.',
    );
  });
});
