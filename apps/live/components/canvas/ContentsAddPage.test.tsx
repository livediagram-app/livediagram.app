// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { addMenuPlace, ContentsAddPage } from './ContentsAddPage';

// docs/specs/007-editor/pages-mode.md "Contents": Add Page opens the four kinds above it.
afterEach(cleanup);

function contents(over: Partial<PageContents> = {}): PageContents {
  return { canAdd: true, add: vi.fn(), full: false, lastKind: 'article', ...over } as PageContents;
}

describe('ContentsAddPage', () => {
  it('opens every kind on the page, outside a panel that clips, the last kind first', () => {
    const c = contents();
    render(
      <div data-testid="panel" style={{ overflow: 'hidden', height: 80 }}>
        <ContentsAddPage contents={c} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    const menu = screen.getByRole('menu', { name: 'Add a page' });
    expect(screen.getByTestId('panel').contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.hasAttribute('data-menu-surface')).toBe(true);
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual([
      'Article',
      'Infographic',
      'Slide',
      'Logo',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add a Logo page' }));
    expect(c.add).toHaveBeenCalledWith('logo');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays shut at the page limit', () => {
    render(<ContentsAddPage contents={contents({ full: true })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape, handing focus back to the button', () => {
    render(<ContentsAddPage contents={contents()} />);
    const button = screen.getByRole('button', { name: 'Add Page' });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

describe('addMenuPlace', () => {
  it('stands the kinds above the button, as wide as it', () => {
    expect(addMenuPlace({ left: 120, top: 700, width: 360 }, 900)).toEqual({
      left: 120,
      width: 360,
      bottom: 204,
    });
  });
});
