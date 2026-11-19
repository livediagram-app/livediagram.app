// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FlyoutHeader } from './CategoryFlyout';
import { FLYOUT_FOOTER_HEIGHT, FlyoutFooter, InfoFooter, Kbd } from './category-flyout-items';
import { NOTE, SQUARE, testKit, type TestTile } from './category-flyout-test-kit';

afterEach(cleanup);

const kit = testKit();
const LONG: TestTile = {
  ...SQUARE,
  description:
    'A long description that runs on well past the two lines the footer has room for. '.repeat(4),
};

// The palette footer's hint with nothing hovered (docs/specs/008-canvas/canvas-and-palette.md): a mouse clicks, a
// touch screen taps, so each pointer is shown its own word. It said "Click" on a phone.
describe('InfoFooter with no tile hovered', () => {
  it('says Click to a mouse and Tap to a touch screen', () => {
    render(<InfoFooter def={null} kit={kit} />);
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
  const height = (def: TestTile | null) => {
    const { container, unmount } = render(<InfoFooter def={def} kit={kit} />);
    const footer = container.querySelector<HTMLElement>('[data-flyout-footer]')!;
    const out = { height: footer.style.height, minHeight: footer.style.minHeight };
    unmount();
    return out;
  };

  it('is the same fixed height with nothing pointed at, a short tile and a long one', () => {
    const expected = { height: `${FLYOUT_FOOTER_HEIGHT}px`, minHeight: '' };
    expect(height(null)).toEqual(expected);
    expect(height(NOTE)).toEqual(expected);
    expect(height(LONG)).toEqual(expected);
  });

  it('clamps the description to the two lines it has room for', () => {
    render(<InfoFooter def={LONG} kit={kit} />);
    const description = screen.getByText(LONG.description.trim());
    expect(description.className).toMatch(/\bline-clamp-2\b/);
    expect(description.className).toMatch(/\bleading-4\b/);
  });
});

describe('FlyoutFooter', () => {
  it('shows the one hint on every pointer when it has no touch wording', () => {
    render(<FlyoutFooter item={null} hint="Pick one." />);
    expect(screen.getAllByText('Pick one.')).toHaveLength(2);
  });

  it('leaves out the key when the item has none', () => {
    render(<FlyoutFooter item={{ name: 'Blur', text: 'Softens it.' }} hint="" />);
    expect(screen.queryByText('Press')).toBeNull();
  });
});

describe('Kbd', () => {
  it('draws a key cap, smaller inside a tile', () => {
    render(
      <>
        <Kbd>R</Kbd>
        <Kbd small>O</Kbd>
      </>,
    );
    expect(screen.getByText('R').className).toContain('h-5');
    expect(screen.getByText('O').className).toContain('h-4');
  });
});

describe('FlyoutHeader', () => {
  it('runs its line to two lines when asked, with something at its end in place of a count', () => {
    render(
      <FlyoutHeader
        icon={<svg />}
        title="Crop"
        tagline="Drag a corner."
        wrap
        aside={<button type="button">Reset</button>}
      />,
    );
    expect(screen.getByText('Drag a corner.').className).toContain('line-clamp-2');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  });
});
