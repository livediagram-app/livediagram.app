// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissEmptyCard, emptyCardDismissed } from '../canvas/empty-card-dismissed';
import { StartAgainTray } from './StartAgainTray';

// Bringing a start back (each editor's docs/specs/007-editor/start-diagramming.md "Bringing it back").

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mountBox(attr: string, rect: DOMRect, palette = false) {
  const card = document.createElement('div');
  if (palette) {
    const root = document.createElement('div');
    root.setAttribute('data-toolbar-palette', '');
    card.setAttribute('data-tour-id', 'palette');
    root.append(card);
    document.body.append(root);
  } else {
    card.setAttribute(attr, '');
    document.body.append(card);
  }
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect);
}

const pill = () =>
  screen.getByText(/Tab 1 is empty/).closest('[data-yields-to-mode]') as HTMLElement;

describe('StartAgainTray', () => {
  it('says nothing while the start is open', () => {
    render(<StartAgainTray closedKey="t:pages" tabName="Tab 1" />);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });

  it('without a palette strip, offers Show Templates as a pill below the top chrome, which brings the start back', () => {
    dismissEmptyCard('t:pages');
    render(<StartAgainTray closedKey="t:pages" tabName="Tab 1" />);
    expect(screen.getByRole('status').textContent).toContain('Tab 1 is empty');
    expect(pill().className).toContain('top-20');
    // A press on the pill never reaches the canvas under it.
    const canvas = vi.fn();
    document.addEventListener('pointerdown', canvas);
    fireEvent.pointerDown(screen.getByRole('status'));
    document.removeEventListener('pointerdown', canvas);
    expect(canvas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show Templates' }));
    expect(emptyCardDismissed('t:pages')).toBe(false);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });

  it('beside a dock, stands the pill just clear of it (livediagram’s Draw)', () => {
    dismissEmptyCard('t:draw');
    mountBox('data-whiteboard-dock', new DOMRect(100, 12, 400, 48));
    render(
      <StartAgainTray closedKey="t:draw" tabName="Tab 1" dockSelector="[data-whiteboard-dock]" />,
    );
    expect(pill().className).not.toContain('top-20');
    expect(pill().style.top).toBe('70px');
  });

  it('beside a dock that is not on screen, falls back to below the top chrome', () => {
    dismissEmptyCard('t:draw');
    render(
      <StartAgainTray closedKey="t:draw" tabName="Tab 1" dockSelector="[data-whiteboard-dock]" />,
    );
    expect(pill().style.top).toBe('80px');
  });

  it('with the strip on screen, hangs from it as its tray, Show Templates its action', () => {
    dismissEmptyCard('t:diagram');
    mountBox('', new DOMRect(300, 12, 600, 46), true);
    render(
      <StartAgainTray
        closedKey="t:diagram"
        tabName="Tab 1"
        dockSelector="[data-whiteboard-dock]"
      />,
    );
    expect(document.querySelector('[data-palette-tray]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show Templates' }));
    expect(emptyCardDismissed('t:diagram')).toBe(false);
  });
});
