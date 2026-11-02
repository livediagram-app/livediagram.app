// @vitest-environment jsdom

// The empty-tab card (docs/specs/007-editor/new-document-route.md, the empty-canvas hint) on a phone held
// on its side: a short screen drops the picture so the card clears the toolbars, and its close reaches a
// 44px tap area on a touch screen (docs/specs/004-interface-design/touch-targets.md).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyCanvasBanner } from './EmptyCanvasBanner';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('EmptyCanvasBanner on a short or touch screen', () => {
  it('hides its picture at 480px tall or less', () => {
    render(<EmptyCanvasBanner tabId="t1" tabName="Tab 1" readOnly={false} />);
    const card = screen.getByRole('region', { name: 'Tab 1 is empty' });
    // The picture's wrapper: the card's child that holds an svg and is not the close button.
    const art = [...card.children].find((el) => el.tagName === 'DIV' && el.querySelector('svg'));
    expect(art?.className).toBe('[@media(max-height:480px)]:hidden');
  });

  it('pads its close to a 44px tap area', () => {
    render(<EmptyCanvasBanner tabId="t1" tabName="Tab 1" readOnly={false} />);
    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(/\btouch-target\b/);
  });
});

// docs/specs/007-editor/new-document-route.md "The empty-canvas hint": there is no template picker over the editor,
// so the card offers no Quick Start; an Editor's empty tab has its mode's start instead.
describe('EmptyCanvasBanner actions', () => {
  it('offers Help but no Quick Start', () => {
    render(<EmptyCanvasBanner tabId="t1" tabName="Tab 1" readOnly={false} />);
    expect(screen.queryByRole('button', { name: /quick start/i })).toBeNull();
    expect(screen.getByText('Add an element from the Palette to get it going.')).toBeTruthy();
  });
});
