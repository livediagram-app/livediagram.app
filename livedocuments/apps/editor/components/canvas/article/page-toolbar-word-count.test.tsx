// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ArticleSelectionState } from '@/lib/article/article-commands';
import { MorePanel } from './page-toolbar-panels';

// docs/specs/007-editor/article-pages.md "Word Count": the foot of More Formatting reads the article's length, and the
// selection's beside it; a line to read, never a choice.
const selection = { marks: new Set() } as unknown as ArticleSelectionState;

describe('More Formatting: Word Count', () => {
  it("reads the article's count at the foot of the menu", () => {
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{ total: 840, selected: null }}
      />,
    );
    const line = screen.getByRole('group', { name: 'Word Count: 840 words' });
    expect(line.textContent).toBe('Word Count840 words');
    // Nothing in it takes a press: it is no menu item.
    expect(line.querySelector('button')).toBeNull();
  });

  it("reads the selection's count beside the total", () => {
    render(
      <MorePanel selection={selection} onAction={vi.fn()} counts={{ total: 840, selected: 12 }} />,
    );
    expect(screen.getByRole('group', { name: 'Word Count: 12 of 840 words' })).toBeTruthy();
  });

  it('shows no count until one is read', () => {
    render(<MorePanel selection={selection} onAction={vi.fn()} />);
    expect(screen.queryByRole('group')).toBeNull();
  });
});
