// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { ContentsAddPage } from './ContentsAddPage';

// docs/specs/007-editor/pages-mode.md "Contents": the same pair as the canvas's + after the last page.
afterEach(cleanup);

function contents(over: Partial<PageContents> = {}): PageContents {
  return {
    canAdd: true,
    add: vi.fn(),
    addLike: vi.fn(),
    lastPage: { id: 'p', kind: 'slide' },
    full: false,
    lastKind: 'slide',
    ...over,
  } as unknown as PageContents;
}

describe('ContentsAddPage', () => {
  it('adds another page like the last from Add Page', () => {
    const c = contents();
    render(<ContentsAddPage contents={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(c.addLike).toHaveBeenCalled();
  });

  it('opens Add a Page for a page of any kind, and adds the kind chosen', () => {
    const c = contents();
    render(<ContentsAddPage contents={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Page of Any Kind' }));
    const chooser = screen.getByRole('dialog', { name: 'Add a Page' });
    expect(chooser.hasAttribute('data-menu-surface')).toBe(true);
    fireEvent.click(chooser.querySelector('[data-add-kind="article"]')!);
    expect(c.add).toHaveBeenCalledWith('article');
    expect(screen.queryByRole('dialog', { name: 'Add a Page' })).toBeNull();
  });

  it('disables both at the page limit, and shows nothing to a Participant or a Viewer', () => {
    render(<ContentsAddPage contents={contents({ full: true })} />);
    expect(screen.getByRole('button', { name: 'Add Page' }).hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Add a Page of Any Kind' }).hasAttribute('disabled'),
    ).toBe(true);
    cleanup();
    const { container } = render(<ContentsAddPage contents={contents({ canAdd: false })} />);
    expect(container.innerHTML).toBe('');
  });
});
