// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagesClusterStrip } from './PagesClusterStrip';
import { ContentsClusterSegment } from './ContentsClusterSegment';

// Pages mode's pages strip (docs/specs/007-editor/pages-mode.md "Contents"): one frame, each segment opening its
// own popover.

afterEach(cleanup);

describe('the pages strip', () => {
  it('holds Contents, which opens its popover', () => {
    const contents = vi.fn();
    render(
      <PagesClusterStrip
        contents={<ContentsClusterSegment popoverOpen={false} onTogglePopover={contents} />}
      />,
    );
    const contentsButton = screen.getByRole('button', { name: 'Contents' });
    fireEvent.click(contentsButton);
    expect(contents).toHaveBeenCalledWith(contentsButton);
    expect(contentsButton.getAttribute('aria-expanded')).toBe('false');
    // Slide decks left livedesign on 25 October 2026: no Slides segment.
    expect(screen.queryByRole('button', { name: /Slides/ })).toBeNull();
  });

  it('is absent with nothing to hold', () => {
    const { container } = render(<PagesClusterStrip contents={null} />);
    expect(container.innerHTML).toBe('');
  });
});
