// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FLYOUT_FOOTER_HEIGHT, InfoFooter } from './category-flyout-items';
import { tileById } from './palette-tile-defs';

afterEach(cleanup);

// The palette footer's hint with nothing hovered (docs/specs/008-canvas/canvas-and-palette.md): a mouse clicks, a
// touch screen taps, so each pointer is shown its own word. It said "Click" on a phone.
describe('InfoFooter with no tile hovered', () => {
  it('says Click to a mouse and Tap to a touch screen', () => {
    render(<InfoFooter def={null} />);
    const click = screen.getByText('Click to add one, or drag it onto the canvas.');
    const tap = screen.getByText('Tap to add one, or drag it onto the canvas.');
    expect(click.className).toMatch(/\bpointer-coarse:hidden\b/);
    expect(tap.className).toMatch(/(^|\s)hidden\b/);
    expect(tap.className).toMatch(/\bpointer-coarse:inline\b/);
  });
});

// docs/specs/007-editor/toolbar-layout.md "The category bar": one height whatever the footer says, so pointing along
// the tiles never resizes the flyout under the pointer.
describe('InfoFooter height', () => {
  const height = (def: Parameters<typeof InfoFooter>[0]['def']) => {
    const { container, unmount } = render(<InfoFooter def={def} />);
    const footer = container.querySelector<HTMLElement>('[data-flyout-footer]')!;
    const out = { height: footer.style.height, minHeight: footer.style.minHeight };
    unmount();
    return out;
  };

  it('is the same fixed height with nothing pointed at, a short tile and a long one', () => {
    const expected = { height: `${FLYOUT_FOOTER_HEIGHT}px`, minHeight: '' };
    expect(height(null)).toEqual(expected);
    expect(height(tileById('tools:text')!)).toEqual(expected);
    expect(height(tileById('data:pie')!)).toEqual(expected);
  });

  it('clamps the description to the two lines it has room for', () => {
    render(<InfoFooter def={tileById('data:pie')!} />);
    const description = screen.getByText(tileById('data:pie')!.description);
    expect(description.className).toMatch(/\bline-clamp-2\b/);
    expect(description.className).toMatch(/\bleading-4\b/);
  });
});
