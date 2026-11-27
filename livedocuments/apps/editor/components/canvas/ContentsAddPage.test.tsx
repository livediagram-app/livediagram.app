// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { ContentsAddPage } from './ContentsAddPage';

// Describe a Page's button stands in as a mark of what it was handed.
vi.mock('./describe-page/DescribePageButton', () => ({
  DescribePageButton: ({ onMade }: { onMade?: () => void }) => (
    <button type="button" data-describe={onMade ? 'closes' : 'stays'} onClick={onMade}>
      Describe
    </button>
  ),
}));

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
  it('adds another page like the last, named for it (Add Slide on a deck)', () => {
    const c = contents();
    render(<ContentsAddPage contents={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Slide' }));
    expect(c.addLike).toHaveBeenCalled();
  });

  // docs/specs/007-editor/flashcards.md "Contents".
  it('reads Add Card on a stack of flashcards', () => {
    const c = contents({ lastPage: { id: 'c', kind: 'flashcard' } as PageContents['lastPage'] });
    render(<ContentsAddPage contents={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
    expect(c.addLike).toHaveBeenCalled();
  });

  it('offers no other kind: the tab holds one (One kind a tab)', () => {
    render(<ContentsAddPage contents={contents()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
  });

  it('is disabled at the page limit, and shows nothing to a Participant or a Viewer', () => {
    render(<ContentsAddPage contents={contents({ full: true })} />);
    expect(screen.getByRole('button', { name: /^Add Slide/ }).hasAttribute('disabled')).toBe(true);
    cleanup();
    const { container } = render(<ContentsAddPage contents={contents({ canAdd: false })} />);
    expect(container.innerHTML).toBe('');
  });

  // docs/specs/007-editor/describe-a-page.md "When it is made": the phone's sheet closes once the page lands.
  it('puts Describe a Page beside it, handing on what closes the phone’s sheet', () => {
    const view = {} as PagesModeView;
    const closed = vi.fn();
    render(<ContentsAddPage contents={contents()} view={view} onDescribed={closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    expect(closed).toHaveBeenCalled();
    cleanup();
    render(<ContentsAddPage contents={contents()} view={view} />);
    expect(document.querySelector('[data-describe="stays"]')).toBeTruthy();
  });
});
