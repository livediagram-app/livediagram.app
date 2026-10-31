// The footer tab's look (docs/specs/007-editor/editor-app.md "How a tab looks"): standing on the screen's bottom edge,
// the open tab a card that joins it, the others quiet with an inset wash, nothing along a tab's top.
import { describe, expect, it } from 'vitest';
import {
  TAB_ADD_CLASS,
  TAB_BAR_CLASS,
  TAB_DASHED_CLASS,
  TAB_STRIP_CLASS,
  tabShapeClass,
} from './tab-shape';

const classes = (s: string) => s.split(/\s+/);

describe('tabShapeClass', () => {
  it('stands every tab on the bottom edge: rounded top, square foot, one height', () => {
    for (const active of [true, false]) {
      const c = classes(tabShapeClass({ active, editing: false, readOnly: false }));
      expect(c).toContain('rounded-t-[10px]');
      expect(c).toContain('h-10');
      expect(c).not.toContain('rounded-lg');
    }
  });

  it('shows the card under the open tab, white and slate-800 in dark, its name semibold', () => {
    const c = classes(tabShapeClass({ active: true, editing: false, readOnly: false }));
    expect(c).toEqual(
      expect.arrayContaining(['before:opacity-100', 'before:bg-white', 'font-semibold', 'z-[1]']),
    );
    expect(
      c.some((k) => k.startsWith('dark:before:bg-[color-mix(in_srgb,var(--color-slate-800)')),
    ).toBe(true);
    // No hover wash on the open tab, and nothing drawn along its top.
    expect(c).not.toContain('hover:after:opacity-100');
    expect(c.join(' ')).not.toMatch(/\bborder-t\b|top-0 h-\[3px\]/);
  });

  it('keeps the other tabs quiet: no card, slate ink, an inset wash on hover', () => {
    const c = classes(tabShapeClass({ active: false, editing: false, readOnly: false }));
    expect(c).toEqual(
      expect.arrayContaining([
        'before:opacity-0',
        'font-medium',
        'text-slate-600',
        'hover:after:opacity-100',
        'after:inset-x-1',
        'after:inset-y-1.5',
      ]),
    );
    expect(c).not.toContain('before:opacity-100');
  });

  it('eases only opacity, and not at all under reduced motion', () => {
    const c = classes(tabShapeClass({ active: true, editing: false, readOnly: false }));
    expect(c).toEqual(
      expect.arrayContaining([
        'before:transition-opacity',
        'after:transition-opacity',
        'motion-reduce:before:transition-none',
        'motion-reduce:after:transition-none',
      ]),
    );
  });

  it('draws the keyboard ring on the tab when its name has focus', () => {
    expect(classes(tabShapeClass({ active: false, editing: false, readOnly: false }))).toContain(
      'has-[[role=tab]:focus-visible]:outline-2',
    );
  });

  it('trims the trailing padding beside the menu button, and sheds it while renaming', () => {
    expect(tabShapeClass({ active: true, editing: false, readOnly: false })).toContain(
      'pl-3.5 pr-1',
    );
    // A Viewer's open tab has no menu button, so its padding stays even.
    expect(tabShapeClass({ active: true, editing: false, readOnly: true })).toContain('px-3.5');
    expect(tabShapeClass({ active: false, editing: false, readOnly: false })).toContain('px-3.5');
    expect(tabShapeClass({ active: true, editing: true, readOnly: false })).toContain('px-1');
  });

  it('dims the tab being dragged', () => {
    expect(
      classes(tabShapeClass({ active: false, editing: false, readOnly: false, dragging: true })),
    ).toContain('opacity-50');
    expect(
      classes(tabShapeClass({ active: false, editing: false, readOnly: false })),
    ).not.toContain('opacity-50');
  });
});

describe('the strip and bar', () => {
  it('stands the tabs at the bar’s foot and scrolls sideways only, its edges fading', () => {
    expect(classes(TAB_STRIP_CLASS)).toEqual(
      expect.arrayContaining([
        'items-end',
        'overflow-x-auto',
        'overflow-y-hidden',
        'scroll-edge-fade',
      ]),
    );
  });

  it('sits the bar a shade below the open tab in both appearances', () => {
    expect(classes(TAB_BAR_CLASS)).toEqual(
      expect.arrayContaining(['bg-slate-100', 'dark:bg-slate-950']),
    );
  });

  it('outlines a Not shared tab dashed, standing the same way', () => {
    expect(classes(TAB_DASHED_CLASS)).toEqual(
      expect.arrayContaining(['border-dashed', 'rounded-t-[10px]', 'h-10']),
    );
  });

  it('gives Add tab a 44px tap area and the tabs’ wash', () => {
    expect(classes(TAB_ADD_CLASS)).toEqual(
      expect.arrayContaining(['touch-target', 'hover:bg-slate-400/[0.16]']),
    );
  });
});
