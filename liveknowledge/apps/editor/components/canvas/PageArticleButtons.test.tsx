// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTabStyleOpen, tabStyleOpener } from '@/lib/tab-style-opener';
import { PageArticleButtons, pageArticleRoom } from './PageArticleButtons';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/article-pages.md "Beside the cog": an article page's Style and Text, each a popover beside
// the cog, Style also opened by the article toolbar's Style command.

afterEach(cleanup);

const section = (part: 'style' | 'text') => <p>{part === 'style' ? 'Looks' : 'Fonts'}</p>;

describe('PageArticleButtons', () => {
  it('opens Style and Text, each its own part of the article style', () => {
    render(<PageArticleButtons labelled styleRequest={0} section={section} />);
    expect(screen.queryByText('Looks')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.getByText('Looks')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.getByText('Fonts')).toBeTruthy();
  });

  it('opens Style when the article toolbar asks', () => {
    const { rerender } = render(
      <PageArticleButtons labelled={false} styleRequest={0} section={section} />,
    );
    expect(screen.queryByText('Looks')).toBeNull();
    rerender(<PageArticleButtons labelled={false} styleRequest={3} section={section} />);
    expect(screen.getByText('Looks')).toBeTruthy();
  });

  it("leads Style with Tab Style for an Editor, the page's one Style button", () => {
    const open = vi.fn();
    const undo = registerTabStyleOpen(open);
    render(<PageArticleButtons labelled styleRequest={0} section={section} tabStyle />);
    expect(screen.getAllByRole('button', { name: 'Style' })).toHaveLength(1);
    const style = screen.getByRole('button', { name: 'Style' });
    fireEvent.click(style);
    fireEvent.click(screen.getByRole('button', { name: /Tab Style/ }));
    expect(open).toHaveBeenCalledTimes(1);
    // The dialog drops from the page's Style button; the popover closed on the way.
    expect(tabStyleOpener()).toBe(style);
    expect(screen.queryByText('Looks')).toBeNull();
    undo();
  });

  it('has no Tab Style row where Tab Style is not offered', () => {
    render(<PageArticleButtons labelled styleRequest={0} section={section} />);
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.queryByRole('button', { name: /Tab Style/ })).toBeNull();
  });

  it('takes more title-bar room named than as icons', () => {
    expect(pageArticleRoom(true)).toBeGreaterThan(pageArticleRoom(false));
  });
});
