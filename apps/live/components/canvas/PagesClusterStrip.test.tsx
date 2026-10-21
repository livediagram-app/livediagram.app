// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagesClusterStrip } from './PagesClusterStrip';
import { ContentsClusterSegment } from './ContentsClusterSegment';

// Pages mode's pages strip (docs/specs/007-editor/pages-mode.md "Contents"): Contents in its own frame,
// opening its popover.

afterEach(cleanup);

describe('the pages strip', () => {
  it('holds Contents, which opens its own popover', () => {
    const contents = vi.fn();
    render(
      <PagesClusterStrip
        contents={<ContentsClusterSegment popoverOpen={false} onTogglePopover={contents} />}
      />,
    );
    const button = screen.getByRole('button', { name: 'Contents' });
    fireEvent.click(button);
    expect(contents).toHaveBeenCalledWith(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('draws nothing without Contents', () => {
    const { container } = render(<PagesClusterStrip contents={null} />);
    expect(container.firstChild).toBeNull();
  });
});
