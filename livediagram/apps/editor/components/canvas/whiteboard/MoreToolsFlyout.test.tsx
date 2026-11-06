// @vitest-environment jsdom
// A bar too wide for its room folds (docs/specs/023-draw-mode/draw-mode.md "When the bar is too
// wide"): the dock measures its room from the probe, sheds its pins, then folds the least-used tools
// into More Tools, whose menu arms them or opens the in-hand tool's own flyout.
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dockModel, renderDock } from './dock-test-utils';

// The room the probe reports, in screen px (the dock draws at scale 1 in tests).
function stubRoom(width: number) {
  const real = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.hasAttribute('data-dock-room'))
      return { left: 0, top: 0, right: width, bottom: 0, width, height: 0 } as DOMRect;
    return real.call(this);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const drawingItems = () =>
  [...document.querySelectorAll<HTMLElement>('[data-dock-group="drawing"] [data-dock-item]')].map(
    (el) => el.dataset.dockItem,
  );
const more = () => screen.getByRole('button', { name: 'More Tools' });
const menu = () => document.getElementById('whiteboard-flyout-more')!;

describe('a dock too wide for its room', () => {
  it('folds nothing while it fits', () => {
    stubRoom(1000);
    renderDock(dockModel('pen', { pinnedShapes: ['arrow', 'rectangle'] }));
    expect(screen.queryByRole('button', { name: 'More Tools' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeTruthy();
  });

  it('takes the pins off the bar first, the last first, into the Shapes flyout', () => {
    // Two pins and the separator: 506 px; one pin fits in 470.
    stubRoom(470);
    renderDock(dockModel('pen', { pinnedShapes: ['arrow', 'rectangle'] }));
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Arrow' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More Tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    const flyout = document.getElementById('whiteboard-flyout-shapes')!;
    expect(within(flyout).getByRole('option', { name: 'Rectangle' })).toBeTruthy();
  });

  it('with no pin left drops the separator, then folds Path and Fill into More Tools', () => {
    stubRoom(400);
    renderDock(dockModel('pen', { pinnedShapes: ['arrow'] }));
    expect(document.querySelector('[data-pinned-separator]')).toBeNull();
    expect(drawingItems()).toEqual(['select', 'main', 'second', 'third', 'text', 'eraser', 'more']);
    expect(more().getAttribute('aria-pressed')).toBe('false');
    expect(more().getAttribute('aria-expanded')).toBe('false');
  });

  it('lists the folded tools in bar order, marks none in hand, and arms one with a press', () => {
    stubRoom(320);
    const m = dockModel('pen');
    renderDock(m);
    fireEvent.click(more());
    expect(more().getAttribute('aria-expanded')).toBe('true');
    const tiles = within(menu()).getAllByRole('button');
    expect(tiles.map((t) => t.getAttribute('aria-label')!.split(',')[0])).toEqual([
      'Marker 3',
      'Path tool',
      'Fill',
      'Eraser',
    ]);
    expect(tiles.every((t) => t.getAttribute('aria-pressed') === 'false')).toBe(true);
    // Each keeps its key.
    expect(tiles[1]!.getAttribute('aria-keyshortcuts')).toBe('P');
    fireEvent.click(within(menu()).getByRole('button', { name: 'Path tool' }));
    expect(m.pickPath).toHaveBeenCalled();
    expect(document.getElementById('whiteboard-flyout-more')).toBeNull();
    fireEvent.click(more());
    fireEvent.click(within(menu()).getByRole('button', { name: /^Marker 3/ }));
    expect(m.pickPen).toHaveBeenCalledWith('third');
  });

  it('is pressed while a folded tool is in hand, and opens that tool’s flyout from it', () => {
    stubRoom(400);
    renderDock(dockModel('fill'));
    expect(more().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(more());
    expect(within(menu()).getByRole('button', { name: 'Fill' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    act(() => {
      fireEvent.click(within(menu()).getByRole('button', { name: 'Fill' }));
    });
    expect(document.getElementById('whiteboard-flyout-more')).toBeNull();
    expect(document.getElementById('whiteboard-flyout-fill')).toBeTruthy();
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(more().getAttribute('aria-controls')).toBe('whiteboard-flyout-fill');
  });

  it('opens a folded marker’s flyout when it is the pen in hand', () => {
    stubRoom(320);
    const m = dockModel('pen');
    renderDock({ ...m, prefs: { ...m.prefs, activePenId: 'third' } });
    expect(more().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(more());
    fireEvent.click(within(menu()).getByRole('button', { name: /^Marker 3/ }));
    expect(document.getElementById('whiteboard-flyout-third')).toBeTruthy();
    expect(m.pickPen).not.toHaveBeenCalled();
  });

  it('a press on More Tools again closes it', () => {
    stubRoom(400);
    renderDock(dockModel('pen'));
    fireEvent.click(more());
    fireEvent.click(more());
    expect(document.getElementById('whiteboard-flyout-more')).toBeNull();
  });
});
