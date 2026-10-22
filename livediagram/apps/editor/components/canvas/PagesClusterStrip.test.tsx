// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagesClusterStrip } from './PagesClusterStrip';
import { ContentsClusterSegment } from './ContentsClusterSegment';
import { SlidesClusterSegment } from './SlidesClusterSegment';

// Pages mode's pages strip (docs/specs/007-editor/pages-mode.md "Contents", "Slides"): Contents and Slides in
// one frame, each opening its own popover.

afterEach(cleanup);

function strip({ slides = true }: { slides?: boolean } = {}) {
  const contents = vi.fn();
  const deck = vi.fn();
  render(
    <PagesClusterStrip
      contents={<ContentsClusterSegment popoverOpen={false} onTogglePopover={contents} />}
      slides={slides ? <SlidesClusterSegment popoverOpen onTogglePopover={deck} /> : null}
    />,
  );
  return { contents, deck };
}

describe('the pages strip', () => {
  it('joins Contents and Slides in one frame, each opening its own popover', () => {
    const { contents, deck } = strip();
    const contentsButton = screen.getByRole('button', { name: 'Contents' });
    const slidesButton = screen.getByRole('button', { name: 'Open Slides' });
    expect(contentsButton.closest('[data-dock-button]')).toBe(
      slidesButton.closest('[data-dock-button]'),
    );
    fireEvent.click(contentsButton);
    expect(contents).toHaveBeenCalledWith(contentsButton);
    fireEvent.click(slidesButton);
    expect(deck).toHaveBeenCalledWith(slidesButton);
    // The open one says so.
    expect(slidesButton.getAttribute('aria-expanded')).toBe('true');
    expect(contentsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('holds Contents alone until a page is a slide', () => {
    strip({ slides: false });
    expect(screen.getByRole('button', { name: 'Contents' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Slides' })).toBeNull();
  });
});
