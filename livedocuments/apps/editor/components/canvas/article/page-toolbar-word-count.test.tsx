// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readabilityOfTexts } from '@livedocuments/document';
import type { ArticleSelectionState } from '@/lib/article/article-commands';
import { MorePanel } from './page-toolbar-panels';

// docs/specs/007-editor/article-pages.md "Word Count": the foot of More Formatting reads the article's length, how
// long it takes to read and how easily it reads, the selection's beside it; a line to read, a choice only when the
// article has a long sentence.
const selection = { marks: new Set() } as unknown as ArticleSelectionState;
const easy = readabilityOfTexts(['The cat sat on the mat.'], 840);
const long = readabilityOfTexts([`${'the '.repeat(31)}end.`, 'The cat sat.'], 840);

describe('More Formatting: Word Count', () => {
  it("reads the article's count, time and level at the foot of the menu", () => {
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{ total: 840, selected: null, readability: easy, selectedReadability: null }}
        onNextLong={vi.fn()}
      />,
    );
    const line = screen.getByRole('group', {
      name: 'Word Count: 840 words · 4 min read · Easy to read',
    });
    expect(line.textContent).toBe('Word Count840 words4 min read · Easy to read');
    // With no long sentence nothing in it takes a press: it is no menu item.
    expect(line.querySelector('button')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Word Count/ })).toBeNull();
  });

  it("reads the article's count alone when there are no figures", () => {
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{ total: 840, selected: null }}
      />,
    );
    const line = screen.getByRole('group', { name: 'Word Count: 840 words' });
    expect(line.textContent).toBe('Word Count840 words');
  });

  it("reads the selection's figures beside the total", () => {
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{
          total: 840,
          selected: 12,
          readability: easy,
          selectedReadability: readabilityOfTexts(['The cat sat on the mat.'], 12),
        }}
      />,
    );
    expect(
      screen.getByRole('group', {
        name: 'Word Count: 12 of 840 words · 1 min read · Easy to read',
      }),
    ).toBeTruthy();
  });

  it('selects the next long sentence when the article has one', () => {
    const onNextLong = vi.fn();
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{ total: 840, selected: null, readability: long, selectedReadability: null }}
        onNextLong={onNextLong}
      />,
    );
    const item = screen.getByRole('menuitem', {
      name: /^Word Count: 840 words · 4 min read.*\. Select the Next Long Sentence$/,
    });
    expect(item.textContent).toContain('1 long');
    fireEvent.click(item);
    expect(onNextLong).toHaveBeenCalledTimes(1);
  });

  it('stays a line to read with a long sentence but nothing to step with', () => {
    render(
      <MorePanel
        selection={selection}
        onAction={vi.fn()}
        counts={{ total: 840, selected: null, readability: long, selectedReadability: null }}
      />,
    );
    expect(screen.queryByRole('menuitem', { name: /Word Count/ })).toBeNull();
    expect(screen.getByRole('group', { name: /^Word Count: 840 words/ })).toBeTruthy();
  });

  it('shows no count until one is read', () => {
    render(<MorePanel selection={selection} onAction={vi.fn()} />);
    expect(screen.queryByRole('group')).toBeNull();
  });
});
