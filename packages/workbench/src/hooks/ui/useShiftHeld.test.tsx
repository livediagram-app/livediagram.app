// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useShiftHeld } from './useShiftHeld';

afterEach(() => {
  fireEvent.keyUp(window, { key: 'Shift' });
  cleanup();
});

function Probe() {
  return <output>{useShiftHeld() ? 'held' : 'up'}</output>;
}

// docs/specs/008-canvas/canvas-and-palette.md: the Shift banner never shows while typing, where Shift is capitals.
describe('useShiftHeld', () => {
  it('holds while Shift is down on the canvas', () => {
    const { container } = render(<Probe />);
    act(() => void fireEvent.keyDown(document.body, { key: 'Shift' }));
    expect(container.textContent).toBe('held');
    act(() => void fireEvent.keyUp(document.body, { key: 'Shift' }));
    expect(container.textContent).toBe('up');
  });

  it.each(['true', '', 'plaintext-only'])(
    'stays up for a capital typed in a contenteditable="%s" line',
    (value) => {
      const { container } = render(<Probe />);
      const line = document.createElement('div');
      line.setAttribute('contenteditable', value);
      const word = document.createElement('span');
      line.appendChild(word);
      document.body.appendChild(line);
      act(() => void fireEvent.keyDown(word, { key: 'Shift' }));
      expect(container.textContent).toBe('up');
      line.remove();
    },
  );
});
