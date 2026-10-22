// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageArticleButtons, pageArticleRoom } from './PageArticleButtons';

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

  it('takes more title-bar room named than as icons', () => {
    expect(pageArticleRoom(true)).toBeGreaterThan(pageArticleRoom(false));
  });
});
