// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InfoFooter } from './category-flyout-items';

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
