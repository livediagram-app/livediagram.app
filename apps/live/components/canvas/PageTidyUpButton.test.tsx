// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { PAGE_TIDY_UP_TOOLTIP, PageTidyUpButton, pageTidyUpRoom } from './PageTidyUpButton';

// docs/specs/007-editor/pages-mode.md "Tidy": an infographic or slide page's title-bar button.
afterEach(() => cleanup());

const as = (level: 'edit' | 'participate' | 'view', ui: ReactNode) => (
  <EditorContext.Provider value={{ can: { level } } as never}>{ui}</EditorContext.Provider>
);

describe('PageTidyUpButton', () => {
  it('tidies its page on a press, its icon alone everywhere', () => {
    const tidyPage = vi.fn();
    render(as('edit', <PageTidyUpButton pageId="p1" edit={{ tidyPage }} />));
    const button = screen.getByRole('button', { name: PAGE_TIDY_UP_TOOLTIP });
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(tidyPage).toHaveBeenCalledWith('p1');
    expect(pageTidyUpRoom()).toBe(28);
  });

  it('shows nothing to a Participant or a Viewer, nor without a tidy', () => {
    for (const level of ['participate', 'view'] as const) {
      render(as(level, <PageTidyUpButton pageId="p1" edit={{ tidyPage: vi.fn() }} />));
      expect(screen.queryByRole('button')).toBeNull();
      cleanup();
    }
    render(as('edit', <PageTidyUpButton pageId="p1" edit={{}} />));
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    render(<PageTidyUpButton pageId="p1" edit={{ tidyPage: vi.fn() }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('previews on a mouse hover only, and drops the preview on leaving or unmounting', () => {
    const previewTidy = vi.fn();
    const ui = as(
      'edit',
      <PageTidyUpButton pageId="p1" edit={{ tidyPage: vi.fn(), previewTidy }} />,
    );
    const { unmount } = render(ui);
    const button = screen.getByRole('button', { name: PAGE_TIDY_UP_TOOLTIP });
    fireEvent.pointerEnter(button, { pointerType: 'touch' });
    expect(previewTidy).not.toHaveBeenCalled();
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    expect(previewTidy).toHaveBeenLastCalledWith('p1');
    fireEvent.pointerLeave(button);
    expect(previewTidy).toHaveBeenLastCalledWith(null);
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    previewTidy.mockClear();
    unmount();
    expect(previewTidy).toHaveBeenCalledWith(null);
  });
});
