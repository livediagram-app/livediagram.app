// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CommentThreadPopover } from './CommentThreadPopover';

// The comment thread popover (docs/specs/007-editor/article-pages.md "Comments and actions"): the
// composer takes the caret when the popover opens, including when its anchor lands a render after
// it (a new margin note's marker), so what is typed next is the comment, not the writing's.

const noop = () => {};

function renderPopover(elementId: string) {
  render(
    <CommentThreadPopover
      elementId={elementId}
      thread={undefined}
      onAddComment={noop}
      onDeleteComment={noop}
      onResolve={noop}
      onUnresolve={noop}
      onClose={noop}
      selfId="me"
    />,
  );
}

function addAnchor(id: string) {
  const anchor = document.createElement('div');
  anchor.dataset.elementId = id;
  document.body.appendChild(anchor);
  return anchor;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('CommentThreadPopover', () => {
  it('focuses the composer when it opens on an anchor already there', () => {
    addAnchor('a');
    renderPopover('a');
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Add a comment…'));
  });

  it('focuses the composer once an anchor that lands later places it', () => {
    renderPopover('late');
    expect(screen.queryByRole('dialog')).toBeNull();
    addAnchor('late');
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Add a comment…'));
  });
});
