import { describe, expect, it } from 'vitest';
import { dropCustomTheme, isRetiredCustomThemeId } from './retired-custom-themes';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { getBuiltInTheme } from './themes';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/document-core/canvas-colors';
import type { Element, Tab } from './index';

const box = {
  id: 'a',
  type: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  fillColor: '#123456',
  strokeColor: '#abcdef',
} as unknown as Element;

const customTab = (): Tab =>
  ({
    id: 't1',
    name: 'Tab',
    theme: 'custom:7d1c7a4e-0b8e-4c4f-9a39-1f2d3c4b5a69',
    backgroundColor: '#1e1b4b',
    patternColor: '#4338ca',
    backgroundPattern: 'dots',
    backgroundOpacity: 0.4,
    elements: [box],
  }) as unknown as Tab;

describe('a tab on a custom theme (docs/specs/011-theme/retired-schemes.md "Custom themes")', () => {
  it('recognises only custom: ids', () => {
    expect(isRetiredCustomThemeId('custom:abc')).toBe(true);
    expect(isRetiredCustomThemeId('brand')).toBe(false);
    expect(isRetiredCustomThemeId(undefined)).toBe(false);
    expect(isRetiredCustomThemeId(42)).toBe(false);
  });

  it('opens on Default with the Default backdrop, its element colours kept', () => {
    const out = migrateStoredTab(customTab());
    expect(out.theme).toBe('brand');
    expect(out.backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(out.patternColor).toBe(DEFAULT_PATTERN_COLOR);
    expect(out.backgroundPattern).toBe('grid');
    expect('backgroundOpacity' in out).toBe(false);
    expect(out.elements[0]).toMatchObject({ fillColor: '#123456', strokeColor: '#abcdef' });
    // The id it now carries resolves to the real Default scheme, not a fallback of a fallback.
    expect(getBuiltInTheme(out.theme).id).toBe('brand');
  });

  it('does the same for a tab arriving from outside (a peer, an api write, a file)', () => {
    const out = migrateIncomingTab(customTab()) as Tab;
    expect(out.theme).toBe('brand');
  });

  it('leaves a tab on a built-in theme as the same object', () => {
    const tab = { theme: 'ocean', backgroundColor: '#fff', patternColor: '#000' };
    expect(dropCustomTheme(tab)).toBe(tab);
  });

  it('is idempotent', () => {
    const once = migrateStoredTab(customTab());
    expect(migrateStoredTab(once)).toEqual(once);
  });

  it('costs the same whatever the tab holds', () => {
    // One prefix test and one shallow copy: the element array is handed through, never walked or copied.
    const elements = Array.from({ length: 50_000 }, (_, i): Element => ({ ...box, id: `e${i}` }));
    const tab = { ...customTab(), elements };
    const out = dropCustomTheme(tab);
    expect(out.elements).toBe(elements);
  });
});
