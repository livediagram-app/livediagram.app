// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PointerWords, touchWording } from './PointerWords';

// A palette blurb that names a click reads as a tap on a touch screen (docs/specs/008-canvas/canvas-and-palette.md).
afterEach(cleanup);

describe('touchWording', () => {
  it('says a click and a double-click as a tap and a double-tap, keeping case', () => {
    expect(touchWording('Double-click to look underneath')).toBe('Double-tap to look underneath');
    expect(touchWording('Text element. Double-click to edit.')).toBe(
      'Text element. Double-tap to edit.',
    );
    expect(touchWording('Click for corners, drag for curves')).toBe(
      'Tap for corners, drag for curves',
    );
    expect(
      touchWording(
        'Click to place points. Click the start to close, double-click to finish a line.',
      ),
    ).toBe('Tap to place points. Tap the start to close, double-tap to finish a line.');
  });

  it('leaves other words alone, "clickable" among them', () => {
    expect(touchWording('A clickable preview of a link')).toBe('A clickable preview of a link');
    expect(touchWording('Rounded rectangle')).toBe('Rounded rectangle');
  });
});

describe('PointerWords', () => {
  it('renders both wordings, each for its own pointer', () => {
    const { container } = render(<PointerWords text="Double-click to edit." />);
    const [mouse, touch] = [...container.querySelectorAll('span')];
    expect(mouse!.textContent).toBe('Double-click to edit.');
    expect(mouse!.className).toBe('pointer-coarse:hidden');
    expect(touch!.textContent).toBe('Double-tap to edit.');
    expect(touch!.className).toBe('hidden pointer-coarse:inline');
  });

  it('renders plain text when nothing names a click', () => {
    const { container } = render(<PointerWords text="Rounded rectangle" />);
    expect(container.innerHTML).toBe('Rounded rectangle');
  });
});
