// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagesClusterStrip } from './PagesClusterStrip';
import { ContentsClusterSegment } from '@liveworkspace/workbench/components/canvas/ContentsClusterSegment';

// Pages mode's pages strip (docs/specs/007-editor/pages-mode.md "Contents"): Contents in its own frame, opening its
// popover. There is no Slides button beside it ("Retired: the Slide Deck panel").

afterEach(cleanup);

describe('the pages strip', () => {
  it('holds Contents alone, opening its popover', () => {
    const contents = vi.fn();
    render(
      <PagesClusterStrip
        contents={<ContentsClusterSegment popoverOpen={false} onTogglePopover={contents} />}
      />,
    );
    const button = screen.getByRole('button', { name: 'Contents' });
    fireEvent.click(button);
    expect(contents).toHaveBeenCalledWith(button);
    expect(screen.queryByRole('button', { name: /Slides/ })).toBeNull();
  });

  it('is absent while Contents is docked as the sidebar', () => {
    const { container } = render(<PagesClusterStrip contents={null} />);
    expect(container.firstChild).toBeNull();
  });
});
