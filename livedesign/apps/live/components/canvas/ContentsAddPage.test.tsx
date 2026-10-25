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
    lastPage: { id: 'p', kind: 'logo' },
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

  it('adds a screen of another device on a wireframe tab', () => {
    const c = contents({
      lastPage: { id: 'p', kind: 'wireframe', device: 'iphone' },
    } as unknown as Partial<PageContents>);
    render(<ContentsAddPage contents={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Screen of Another Device' }));
    const chooser = screen.getByRole('dialog', { name: 'Choose a Device' });
    expect(chooser.hasAttribute('data-menu-surface')).toBe(true);
    expect(chooser.querySelector('[data-add-kind]')).toBeNull();
    fireEvent.click(chooser.querySelector('[data-device-row="ipad"]')!);
    expect(c.add).toHaveBeenCalledWith('wireframe', 'ipad');
    expect(screen.queryByRole('dialog', { name: 'Choose a Device' })).toBeNull();
  });

  it('is disabled at the page limit, and shows nothing to a Participant, a Viewer or a blank tab', () => {
    render(<ContentsAddPage contents={contents({ full: true })} />);
    expect(screen.getByRole('button', { name: 'Add Page' }).hasAttribute('disabled')).toBe(true);
    cleanup();
    const { container } = render(<ContentsAddPage contents={contents({ canAdd: false })} />);
    expect(container.innerHTML).toBe('');
    cleanup();
    const blank = render(<ContentsAddPage contents={contents({ lastPage: undefined })} />);
    expect(blank.container.innerHTML).toBe('');
  });
});
