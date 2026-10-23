// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { ContentsAddPage } from './ContentsAddPage';

// docs/specs/007-editor/pages-mode.md "Contents": the canvas's + after the last page, as a wide button.
afterEach(cleanup);

function contents(over: Partial<PageContents> = {}): PageContents {
  return {
    canAdd: true,
    add: vi.fn(),
    addLike: vi.fn(),
    lastPage: { id: 'p', kind: 'slide' },
    full: false,
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

  it('offers no other kind: the tab holds one (One kind a tab)', () => {
    render(<ContentsAddPage contents={contents()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
  });

  it('is disabled at the page limit, and shows nothing to a Participant or a Viewer', () => {
    render(<ContentsAddPage contents={contents({ full: true })} />);
    expect(screen.getByRole('button', { name: 'Add Page' }).hasAttribute('disabled')).toBe(true);
    cleanup();
    const { container } = render(<ContentsAddPage contents={contents({ canAdd: false })} />);
    expect(container.innerHTML).toBe('');
  });
});
