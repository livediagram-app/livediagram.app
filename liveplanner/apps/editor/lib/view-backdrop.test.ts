import { afterEach, describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { resetAppearanceForTests } from '@liveplanner/ui';
import { resolveTabBackdrop } from './themes';
import { resolveViewBackdrop } from './view-backdrop';

// docs/specs/026-plan/plan-mode.md "The canvas": the tab's own colour and pattern, its theme's included.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't1', name: 'Tab 1', elements: [], ...over });

afterEach(() => resetAppearanceForTests());

describe('resolveViewBackdrop', () => {
  it('paints the theme’s own pattern', () => {
    const t = tab({ theme: 'slate', backgroundColor: '#fdf2f8' });
    expect(resolveViewBackdrop(t)).toEqual(resolveTabBackdrop(t));
    expect(resolveViewBackdrop(tab()).backgroundPattern).not.toBe('blank');
  });

  it('shows a pattern someone picked', () => {
    const t = tab({ theme: 'slate', backgroundPattern: 'hexagonal' });
    expect(resolveViewBackdrop(t)).toEqual(resolveTabBackdrop(t));
  });
});
