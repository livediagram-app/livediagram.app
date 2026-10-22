// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The photo tools": the tools used most on the strip, every tool in a category
// whose flyout lists its groups, a group of several opening its tools beside it.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PINNED_GROUPS, STRIP_CATEGORIES } from '@/lib/photo-editor/tool-categories';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { photoTools, TOOL_GROUPS } from '@/lib/photo-editor/tool-state';
import { PhotoToolCategories } from './PhotoToolCategories';

beforeEach(() => act(() => photoTools.take(null)));
afterEach(cleanup);

describe('the photo tool categories', () => {
  it('reach every tool group, on the strip or in a category, each category once', () => {
    const listed = STRIP_CATEGORIES.flatMap((c) => c.groups);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...new Set([...listed, ...PINNED_GROUPS])].sort()).toEqual(
      TOOL_GROUPS.map((g) => g.id).sort(),
    );
  });

  it('open a flyout of groups, a group of several its tools beside it, and take the one pressed', () => {
    render(<PhotoToolCategories pinned={new Set(PINNED_GROUPS)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    const flyout = screen.getByRole('menu', { name: 'Select' });
    fireEvent.pointerEnter(within(flyout).getByRole('button', { name: 'Lasso' }));
    const side = screen.getByRole('menu', { name: 'Lasso' });
    expect(
      within(side)
        .getAllByRole('menuitem')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Lasso', 'Polygon Lasso', 'Magnetic Lasso']);
    fireEvent.click(within(side).getByRole('menuitem', { name: 'Magnetic Lasso' }));
    expect(photoTools.get().tool).toBe('magnetic-lasso');
    expect(screen.queryByRole('menu')).toBeNull();
    // The category marks the tool in hand, which no pinned button shows.
    expect(screen.getByRole('button', { name: 'Select' }).className).toContain('bg-brand-100');
  });

  it('take a group of one at once, and close on Escape', () => {
    render(<PhotoToolCategories pinned={new Set(PINNED_GROUPS)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retouch' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clone Stamp' }));
    expect(photoTools.get().tool).toBe('clone');
    fireEvent.click(screen.getByRole('button', { name: 'Paint' }));
    expect(screen.getByRole('menu', { name: 'Paint' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('list the tools of a flat group as rows of their own, with no panel beside', () => {
    render(<PhotoToolCategories pinned={new Set(PINNED_GROUPS)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    const flyout = screen.getByRole('menu', { name: 'Shapes' });
    expect(
      within(flyout)
        .getAllByRole('menuitem')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Text', 'Rectangle', 'Ellipse', 'Line']);
    fireEvent.pointerEnter(within(flyout).getByRole('menuitem', { name: 'Ellipse' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    fireEvent.click(within(flyout).getByRole('menuitem', { name: 'Ellipse' }));
    expect(photoTools.get().tool).toBe('ellipse');
    expect(screen.queryByRole('menu')).toBeNull();
    // The category holds it, for the options card to hang from; pressed again, the tool opens its options.
    expect(screen.getByRole('button', { name: 'Shapes' }).hasAttribute('data-photo-holds')).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ellipse' }));
    expect(toolFlyout.isOpen()).toBe(true);
  });
});
