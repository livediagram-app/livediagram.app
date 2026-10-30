// The footer tab's shape (docs/specs/007-editor/editor-app.md "How a tab looks"): standing on the screen's bottom edge,
// the active tab open at its foot, the others flat with a hairline between neighbours.
import { describe, expect, it } from 'vitest';
import { TAB_STRIP_CLASS, tabShapeClass } from './tab-shape';

const classes = (s: string) => s.split(/\s+/);

describe('tabShapeClass', () => {
  it('stands every tab on the bottom edge: rounded top, square foot, one height', () => {
    for (const active of [true, false]) {
      const c = classes(tabShapeClass({ active, editing: false, readOnly: false }));
      expect(c).toContain('rounded-t-lg');
      expect(c).toContain('h-10');
      expect(c).not.toContain('rounded-lg');
      // The border is kept (transparent when unused), so a tab keeps its width as it becomes active.
      expect(c).toEqual(expect.arrayContaining(['border-x', 'border-t']));
    }
  });

  it('raises the active tab as a card outlined on top and sides, open at its foot, in light and dark', () => {
    const c = classes(tabShapeClass({ active: true, editing: false, readOnly: false }));
    expect(c).toEqual(
      expect.arrayContaining(['bg-white', 'dark:bg-slate-800', 'border-slate-200', 'z-[1]']),
    );
    expect(c).not.toContain('border-b');
    expect(c).not.toContain('border-transparent');
  });

  it('keeps the other tabs flat, with a hover fill and a hairline only after another flat tab', () => {
    const c = classes(tabShapeClass({ active: false, editing: false, readOnly: false }));
    expect(c).toEqual(
      expect.arrayContaining([
        'border-transparent',
        'hover:bg-slate-200/70',
        'before:opacity-0',
        '[[data-tab]:not([data-active])+&]:before:opacity-100',
      ]),
    );
    expect(c).not.toContain('bg-white');
  });

  it('trims the trailing padding beside the menu button, and sheds it while renaming', () => {
    expect(tabShapeClass({ active: true, editing: false, readOnly: false })).toContain('pl-3 pr-1');
    // A Viewer's active tab has no menu button, so its padding stays even.
    expect(tabShapeClass({ active: true, editing: false, readOnly: true })).toContain('px-3');
    expect(tabShapeClass({ active: false, editing: false, readOnly: false })).toContain('px-3');
    expect(tabShapeClass({ active: true, editing: true, readOnly: false })).toContain('px-0.5');
  });
});

describe('TAB_STRIP_CLASS', () => {
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
});
