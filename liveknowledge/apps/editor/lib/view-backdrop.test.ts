import { afterEach, describe, expect, it } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import { resetAppearanceForTests, setAppearance } from '@liveknowledge/ui';
import { PAGE_GROUND, resolveViewBackdrop } from './view-backdrop';

// docs/specs/030-knowledgebase/page-surface.md "No paper, no canvas": the ground follows the app's appearance and
// nothing else.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'Tab 1', elements: [], ...over });

afterEach(() => resetAppearanceForTests());

describe('resolveViewBackdrop', () => {
  it('is white with no pattern in the light theme, whatever the tab stores', () => {
    const stored = tab({
      theme: 'slate',
      backgroundPattern: 'grid',
      backgroundColor: '#fde68a',
      patternColor: '#000000',
      backgroundOpacity: 0.4,
    });
    for (const t of [tab(), stored]) {
      const backdrop = resolveViewBackdrop(t);
      expect(backdrop.backgroundColor).toBe('#ffffff');
      expect(backdrop.backgroundPattern).toBe('blank');
      expect(backdrop.backgroundOpacity).toBe(1);
    }
  });

  it('is the dark chrome’s ground in the dark theme, whatever the tab stores', () => {
    setAppearance('dark');
    expect(resolveViewBackdrop(tab({ backgroundColor: '#fde68a' })).backgroundColor).toBe(
      PAGE_GROUND.dark,
    );
    expect(resolveViewBackdrop(tab(), 'light').backgroundColor).toBe(PAGE_GROUND.light);
  });

  it('answers the same object while the appearance holds, so nothing drawn from it re-renders', () => {
    expect(resolveViewBackdrop(tab())).toBe(resolveViewBackdrop(tab({ theme: 'slate' })));
  });
});
