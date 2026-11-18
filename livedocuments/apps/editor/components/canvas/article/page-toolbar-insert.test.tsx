// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InsertPanel } from './page-toolbar-panels';

// docs/specs/007-editor/article-pages.md "The page toolbar": the Insert menu's objects, each chart the slash menu offers
// among them, each handed to the article's insert by its kind (Work Tracker 1090).
describe('page toolbar: Insert', () => {
  it('offers Bar, Pie and Line charts and hands each pick on by its kind', () => {
    const onObject = vi.fn();
    const onBlock = vi.fn();
    render(<InsertPanel onObject={onObject} onBlock={onBlock} />);
    for (const [name, kind] of [
      ['Bar Chart', 'chart'],
      ['Pie Chart', 'pie'],
      ['Line Chart', 'line'],
      ['Image', 'image'],
    ] as const) {
      fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${name}`) }));
      expect(onObject).toHaveBeenLastCalledWith(kind);
    }
    fireEvent.click(screen.getByRole('menuitem', { name: /^Table of Contents/ }));
    expect(onBlock).toHaveBeenCalledWith('toc');
  });
});
