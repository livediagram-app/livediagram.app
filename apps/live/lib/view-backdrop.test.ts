import { afterEach, describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { resetAppearanceForTests } from '@liveplanner/ui';
import { resolveTabBackdrop } from './themes';
import { resolveViewBackdrop } from './view-backdrop';

// docs/specs/026-plan/plan-mode.md "The canvas": the tab's own colour, on a blank canvas while the tab keeps its
// theme's pattern.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'Tab 1', elements: [], ...over });

afterEach(() => resetAppearanceForTests());

describe('resolveViewBackdrop', () => {
  it('paints the canvas blank while the tab keeps its theme’s pattern', () => {
    const t = tab({ theme: 'slate', backgroundColor: '#fdf2f8' });
    expect(resolveViewBackdrop(t)).toEqual({
      ...resolveTabBackdrop(t),
      backgroundPattern: 'blank',
    });
    expect(resolveViewBackdrop(tab()).backgroundPattern).toBe('blank');
  });

  it('shows a pattern someone picked', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'hexagonal' });
    expect(resolveViewBackdrop(t)).toEqual(resolveTabBackdrop(t));
  });
});
