// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CommentThreadPopover, commentPopoverBox } from './CommentThreadPopover';

// The comment thread popover (docs/specs/012-collaboration/comment-pin.md): the composer takes the caret when the
// popover opens, including when its anchor lands a render after it, so what is typed next is the comment.

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

  // Portalled to the body, its header was a second page banner, and the dialog had no name.
  it('is a dialog named by its heading, with no banner landmark of its own', () => {
    addAnchor('a');
    renderPopover('a');
    expect(screen.getByRole('dialog', { name: /^Comments/ })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('has a Close that takes a finger tap height', () => {
    addAnchor('a');
    renderPopover('a');
    // Close takes a finger's tap height (docs/specs/004-interface-design/touch-targets.md).
    expect(screen.getByRole('button', { name: 'Close comments' }).className).toContain(
      'touch-target-y',
    );
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

// docs/specs/013-workspace/share-roles.md: a Viewer only looks.
describe('CommentThreadPopover for a Viewer', () => {
  it('reads the thread with no composer, no resolve and no delete', () => {
    addAnchor('a');
    const thread = {
      resolved: false,
      comments: [
        {
          id: 'c1',
          text: 'Mine',
          createdAt: 0,
          authorName: 'Me',
          authorColor: '#000',
          authorId: 'me',
        },
      ],
    };
    render(
      <CommentThreadPopover
        elementId="a"
        thread={thread as never}
        onAddComment={noop}
        onDeleteComment={noop}
        onResolve={noop}
        onUnresolve={noop}
        onClose={noop}
        readOnly
        canComment={false}
        selfId="me"
      />,
    );
    expect(screen.getByText('Mine')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Add a comment…')).toBeNull();
    expect(screen.queryByRole('button', { name: /resolve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Opening the thread": the whole popover stays on screen, so a low
// element's reply box is never below the fold.
describe('commentPopoverBox', () => {
  const viewport = { width: 1200, height: 800 };
  const at = (top: number) => ({ left: 100, right: 200, top });

  it('lines its top up with the element while it fits', () => {
    expect(commentPopoverBox(at(300), 240, viewport)).toEqual({ left: 212, top: 300 });
  });

  it('moves up to keep its foot on screen for an element low in the view', () => {
    const { top } = commentPopoverBox(at(700), 240, viewport);
    expect(top + 240).toBeLessThanOrEqual(800);
    expect(top).toBeLessThan(700);
  });

  it('keeps its top on screen when it is taller than the view', () => {
    expect(commentPopoverBox(at(700), 900, viewport).top).toBeGreaterThan(0);
  });

  it('flips left of an element at the right edge', () => {
    expect(commentPopoverBox({ left: 1000, right: 1100, top: 50 }, 0, viewport).left).toBe(700);
  });
});

describe('CommentThreadPopover placement', () => {
  it('measures itself once drawn and sits above the fold for an element at the foot of the view', () => {
    const anchor = addAnchor('low');
    anchor.getBoundingClientRect = () =>
      ({
        left: 100,
        right: 200,
        top: window.innerHeight - 40,
        bottom: window.innerHeight,
      }) as DOMRect;
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).getAttribute('role') === 'dialog' ? 200 : 0;
      },
    });
    try {
      renderPopover('low');
      const top = parseFloat(screen.getByRole('dialog').style.top);
      expect(top + 200).toBeLessThanOrEqual(window.innerHeight);
    } finally {
      if (height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', height);
    }
  });
});
